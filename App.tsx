
import React, { useState, useEffect, useRef } from 'react';
import { UserInfo, ProductInfo, AnalysisResult, TariffSuggestion } from './types';
import { analyzeProductQualityRequirements, suggestTariffCode, registerUserLead } from './services/geminiService';
import { StepIndicator } from './components/StepIndicator';

const COUNTRIES = [
  "Estados Unidos", "Unión Europea", "China", "Colombia", "Perú", 
  "Chile", "Brasil", "México", "Panamá", "Canadá", 
  "Reino Unido", "Japón", "Corea del Sur", "Emiratos Árabes Unidos"
].sort();

const UpcontrolIsotype = ({ size = 24, color = "#A81B1B" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 78.3 21.7 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10" stroke={color} strokeWidth="14" fill="none"/>
    <path d="M 67 33 A 24 24 0 1 0 50 74 A 24 24 0 1 0 50 26" stroke={color} strokeWidth="11" fill="none"/>
    <path d="M 57.1 42.9 A 10 10 0 1 0 50 60 A 10 10 0 1 0 50 40" stroke={color} strokeWidth="9" fill="none"/>
    <circle cx="50" cy="50" r="5" fill={color} />
  </svg>
);

const UpcontrolLogo = ({ textColor = "text-black", iconColor = "#A81B1B", sizeClass = "text-2xl", className = "" }: { textColor?: string; iconColor?: string; sizeClass?: string; className?: string }) => (
  <div className={`inline-flex items-center antialiased whitespace-nowrap leading-none ${sizeClass} ${className}`} style={{ letterSpacing: '-0.05em' }}>
    <span className={`font-black ${textColor}`} style={{ fontFamily: 'Arial, sans-serif' }}>Upcontr</span>
    <div className="mx-[0.05em] flex items-center justify-center translate-y-[0.05em]">
      <UpcontrolIsotype size={sizeClass.includes('text-4xl') ? 48 : sizeClass.includes('text-2xl') ? 32 : 24} color={iconColor} />
    </div>
    <span className={`font-black ${textColor}`} style={{ fontFamily: 'Arial, sans-serif' }}>l</span>
  </div>
);

const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TariffSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  
  const [userInfo, setUserInfo] = useState<UserInfo>({ firstName: '', lastName: '', email: '', phone: '' });
  const [countryCode, setCountryCode] = useState('+593');
  const [phoneBody, setPhoneBody] = useState('');
  
  const [productInfo, setProductInfo] = useState<ProductInfo>({ 
    name: '', tariffCode: '', operationType: 'production', destinationCountry: ''
  });
  
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const WHATSAPP_LINK = "https://wa.me/593997648189";
  const CALENDAR_LINK = "https://calendar.app.google/dehEYWtqPdMJRPMi8";

  useEffect(() => {
    const savedUser = localStorage.getItem('upcontrol_user_info');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUserInfo(parsed);
        if (parsed.phone?.startsWith('+593')) setPhoneBody(parsed.phone.replace('+593', ''));
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    setUserInfo(prev => ({ ...prev, phone: `${countryCode}${phoneBody.trim()}` }));
  }, [countryCode, phoneBody]);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleNextStep = async () => {
    if (step === 1) {
      if (!userInfo.firstName.trim() || !userInfo.lastName.trim() || !userInfo.email.trim() || !phoneBody.trim()) {
        setError("Todos los campos son obligatorios.");
        return;
      }
      if (!validateEmail(userInfo.email)) {
        setError("Ingrese un correo válido.");
        return;
      }
      setError(null);
      setLoading(true);
      await registerUserLead(userInfo);
      localStorage.setItem('upcontrol_user_info', JSON.stringify(userInfo));
      setLoading(false);
      setStep(2);
    } else if (step === 2) {
      if (!productInfo.name || !productInfo.tariffCode) {
        setError("Indique producto y partida arancelaria.");
        return;
      }
      if (productInfo.operationType === 'export' && !productInfo.destinationCountry) {
        setError("Seleccione un país de destino para la exportación.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await registerUserLead(userInfo, productInfo);
        const data = await analyzeProductQualityRequirements(userInfo, productInfo);
        setResult(data);
        setStep(3);
      } catch (err) {
        setError("Error en el análisis técnico.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSuggestTariff = async () => {
    if (!productInfo.name.trim()) return;
    setSuggesting(true);
    try {
      const suggested = await suggestTariffCode(productInfo.name);
      setSuggestions(suggested || []);
    } catch (err) {
      setError("Error al consultar aranceles.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleNewAnalysis = () => {
    setStep(2);
    setProductInfo({ name: '', tariffCode: '', operationType: 'production', destinationCountry: '' });
    setResult(null);
    setSuggestions([]);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setLoading(true);
    const element = reportRef.current;
    
    const opt = {
      margin: 0,
      filename: `Reporte_Upcontrol_${productInfo.name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { 
        scale: 3, 
        useCORS: true, 
        letterRendering: true, 
        windowWidth: 794, 
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
    };

    try {
      // @ts-ignore
      await window.html2pdf().from(element).set(opt).save();
    } catch (e) {
      console.error("Error al generar PDF:", e);
    } finally {
      setLoading(false);
    }
  };

  const ReportHeader = () => (
    <div className="border-b-[1.5px] border-slate-900 pb-2 flex justify-between items-end mb-3 w-full">
      <div className="flex flex-col gap-0.5">
        <UpcontrolLogo sizeClass="text-2xl" />
        <div>
          <h1 className="text-[11px] font-black uppercase leading-tight text-slate-900">Guía Técnica: Infraestructura de la Calidad</h1>
          <p className="text-[7.5px] font-black text-[#991B1B] uppercase tracking-[0.1em]">
            {productInfo.operationType === 'production' ? 'Producción para Consumo Nacional' : 
             productInfo.operationType === 'import' ? 'Importación' : 'Exportación'}
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className="bg-slate-900 text-white px-2 py-0.5 text-[7.5px] font-black uppercase tracking-[0.15em] rounded-sm">Informe Técnico</div>
        <p className="text-[6.5px] text-slate-400 font-bold mt-1 uppercase">Edición 2026</p>
      </div>
    </div>
  );

  const ReportFooter = () => (
    <div className="mt-auto pt-2.5 border-t-[1.5px] border-slate-900 w-full">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <p className="text-[9.5px] font-black text-slate-900 leading-none mb-1">Mauricio Rodríguez Estrada</p>
          <p className="text-[7.5px] font-black text-[#991B1B] uppercase mb-1.5 tracking-tight">GERENTE / CONSULTOR TÉCNICO</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[8px] font-bold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#991B1B] rounded-full"></span>
              <a href="https://www.upcontrol.com.ec" target="_blank" rel="noopener noreferrer" className="hover:text-[#991B1B] decoration-none">www.upcontrol.com.ec</a>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#991B1B] rounded-full"></span>
              <a href="mailto:info@upcontrol.com.ec" className="hover:text-[#991B1B] decoration-none">info@upcontrol.com.ec</a>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#991B1B] rounded-full"></span>
              Quito, Ecuador
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#991B1B] rounded-full"></span>
              +593 997648189
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <UpcontrolLogo sizeClass="text-xl opacity-80" />
          <p className="text-[6px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Expertos en Calidad</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center antialiased">
      <nav className="bg-white border-b h-16 sticky top-0 z-50 w-full flex justify-center no-print">
        <div className="max-w-5xl w-full px-6 flex items-center justify-between">
          <UpcontrolLogo sizeClass="text-xl" />
          <div className="flex gap-4">
            <a href={CALENDAR_LINK} target="_blank" className="bg-white border-2 border-slate-900 text-slate-900 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all">Agendar Cita</a>
            <a href={WHATSAPP_LINK} target="_blank" className="bg-[#25D366] text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#128C7E] shadow-sm transition-all">WhatsApp</a>
          </div>
        </div>
      </nav>

      <main className="w-full max-w-4xl px-4 py-8">
        <div className="no-print">
          <StepIndicator currentStep={step} />
          {step < 3 && (
            <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 mb-8 text-center">
              <UpcontrolLogo sizeClass="text-4xl mb-6" />
              <h2 className="text-xl font-black text-slate-900 mb-4 uppercase tracking-tight">Asistente de Infraestructura de la Calidad</h2>
              <div className="text-slate-600 text-sm max-w-xl mx-auto leading-relaxed space-y-4">
                <p>¡Hola, bienvenido! Te presentamos nuestra herramienta <strong className="text-[#991B1B]">GRATUITA</strong> que te ayuda a reducir riesgos, mejorar y cumplir <strong className="uppercase">requisitos de infraestructura de la calidad</strong> de producción para consumo nacional, importación y exportación.</p>
                <p className="font-medium italic">Estamos para apoyarte en tus objetivos y resultados esperados.</p>
                <div className="flex justify-center gap-4 pt-2">
                   <a href="https://www.upcontrol.com.ec" target="_blank" className="text-[11px] font-black text-[#991B1B] uppercase tracking-widest border-b-2 border-[#991B1B]/20 hover:border-[#991B1B]">www.upcontrol.com.ec</a>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-6 text-red-700 font-bold text-xs no-print">{error}</div>}

        {loading ? (
          <div className="bg-white p-20 rounded-[40px] shadow-xl text-center no-print">
            <div className="animate-spin inline-block mb-6"><UpcontrolIsotype size={60} /></div>
            <h2 className="text-xl font-black uppercase text-slate-900">Analizando Datos...</h2>
          </div>
        ) : (
          <div className="w-full">
            {step === 1 && (
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 no-print animate-in fade-in zoom-in-95 duration-500">
                <h2 className="text-center text-lg font-black uppercase mb-8 tracking-widest">Contacto Directo</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#991B1B]" placeholder="Nombre" value={userInfo.firstName} onChange={e => setUserInfo({...userInfo, firstName: e.target.value})} />
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#991B1B]" placeholder="Apellido" value={userInfo.lastName} onChange={e => setUserInfo({...userInfo, lastName: e.target.value})} />
                  <input className="w-full md:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#991B1B]" placeholder="Correo Corporativo" value={userInfo.email} onChange={e => setUserInfo({...userInfo, email: e.target.value})} />
                  <div className="md:col-span-2 flex gap-3">
                    <select className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-4 text-xs font-bold" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}><option value="+593">🇪🇨 +593</option><option value="+1">🇺🇸 +1</option></select>
                    <input className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#991B1B]" placeholder="Celular" value={phoneBody} onChange={e => setPhoneBody(e.target.value.replace(/\D/g, '').slice(0, 9))} />
                  </div>
                </div>
                <button onClick={handleNextStep} className="w-full mt-10 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#991B1B] shadow-lg transition-all">Siguiente Paso</button>
              </div>
            )}

            {step === 2 && (
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-black uppercase mb-8 text-center tracking-tight">Detalles del Producto</h3>
                <div className="space-y-6">
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-[#991B1B]" placeholder="Nombre del Producto (ej: Camisa de algodón)" value={productInfo.name} onChange={e => setProductInfo({...productInfo, name: e.target.value})} />
                  <div className="relative">
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-[#991B1B]" placeholder="Partida Arancelaria (10 dígitos)" value={productInfo.tariffCode} onChange={e => setProductInfo({...productInfo, tariffCode: e.target.value})} />
                    <button onClick={handleSuggestTariff} disabled={suggesting} className="absolute right-5 top-4 text-[9px] font-black uppercase underline text-[#991B1B] hover:text-black transition-colors">{suggesting ? 'Buscando...' : 'Sugerir Partida Arancelaria'}</button>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-[#991B1B]/10 grid gap-2">
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => {setProductInfo({...productInfo, tariffCode: s.code}); setSuggestions([])}} className="text-left p-2 bg-white rounded-lg text-[10px] font-bold border border-slate-100 hover:border-[#991B1B] transition-all">
                          <span className="text-[#991B1B]">{s.code}</span> - {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {['production', 'import', 'export'].map((op) => (
                      <button key={op} onClick={() => setProductInfo({...productInfo, operationType: op as any})} className={`py-3 px-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${productInfo.operationType === op ? 'bg-[#991B1B] border-[#991B1B] text-white shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>
                        {op === 'production' ? 'Producción para Consumo Nacional' : op === 'import' ? 'Importación' : 'Exportación'}
                      </button>
                    ))}
                  </div>

                  {productInfo.operationType === 'export' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-2">Mercado de Destino</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-[#991B1B] appearance-none"
                        value={productInfo.destinationCountry}
                        onChange={e => setProductInfo({...productInfo, destinationCountry: e.target.value})}
                      >
                        <option value="">Seleccione un país...</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <button onClick={handleNextStep} className="w-full mt-10 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#991B1B] shadow-lg transition-all">Generar Guía Técnica</button>
              </div>
            )}

            {step === 3 && result && (
              <div className="flex flex-col items-center gap-8 animate-in fade-in duration-700">
                <div className="w-full overflow-hidden bg-slate-800 p-4 md:p-8 rounded-[40px] flex justify-center no-print shadow-2xl">
                  <div 
                    ref={reportRef} 
                    className="w-[595pt] h-[841pt] bg-white flex flex-col text-slate-900 font-sans overflow-hidden relative"
                    style={{ margin: '0 auto' }}
                  >
                    <div className="w-full h-full flex flex-col bg-white box-border p-[30pt_50pt_30pt_50pt]">
                      <ReportHeader />
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="border-l-[2.5px] border-[#991B1B] pl-3.5 py-0.5">
                          <p className="text-[7px] font-black text-[#991B1B] uppercase mb-0.5 tracking-[0.05em]">Solicitante</p>
                          <p className="text-[10px] font-black uppercase text-slate-900 leading-tight">{userInfo.firstName} {userInfo.lastName}</p>
                          <p className="text-[7.5px] font-bold text-slate-400">{userInfo.email}</p>
                        </div>
                        <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 flex flex-col justify-center gap-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Partida Arancelaria</span>
                            <span className="text-[9px] font-black text-slate-900 tracking-tight">{productInfo.tariffCode}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200/50 pt-1">
                            <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Mercado / Producto</span>
                            <span className="text-[8px] font-black text-[#991B1B] uppercase truncate max-w-[130pt]">
                              {productInfo.operationType === 'export' ? productInfo.destinationCountry : 'Ecuador'} | {productInfo.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <section className="mb-4">
                        <h2 className="text-[8.5px] font-black uppercase border-b border-slate-900/10 pb-1 mb-2.5 tracking-widest flex items-center gap-2">
                          <span className="w-1 h-3 bg-[#991B1B]"></span> Requisitos de Infraestructura de la Calidad Obligatorios
                        </h2>
                        <div className="grid grid-cols-2 gap-3.5">
                          {[
                            { title: 'Normalización', content: result.obligatoryRequirements.normalization },
                            { title: 'Reglamentación y Etiquetado', content: result.obligatoryRequirements.regulation },
                            { title: 'Acreditación / Ensayos', content: result.obligatoryRequirements.accreditation },
                            { title: 'Metrología Legal', content: result.obligatoryRequirements.metrology },
                          ].map((req, i) => (
                            <div key={i} className="p-3 bg-slate-50/40 border border-slate-100/50 rounded-lg">
                              <p className="text-[7px] font-black text-[#991B1B] uppercase mb-1 tracking-widest">{req.title}</p>
                              <p className="text-[8px] leading-[1.3] text-slate-700 font-medium whitespace-pre-wrap">{req.content}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="flex-1">
                        <h2 className="text-[8.5px] font-black uppercase border-b border-slate-900/10 pb-1 mb-2.5 tracking-widest flex items-center gap-2">
                          <span className="w-1 h-3 bg-[#991B1B]"></span> Estrategias de Competitividad y mejoramiento opcionales
                        </h2>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                          {result.optionalRequirements.slice(0, 8).map((req, i) => (
                            <div key={i} className="flex gap-3 items-start border-b border-slate-50/50 pb-2">
                              <div className="mt-1 flex-shrink-0"><UpcontrolIsotype size={8} /></div>
                              <div>
                                <p className="text-[8px] font-black text-slate-900 mb-1 uppercase tracking-tight leading-none">{req.title}</p>
                                <p className="text-[7.5px] text-slate-500 leading-tight font-medium text-justify">{req.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <div className="mt-4 mb-4 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-center">
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.05em] leading-relaxed max-w-[95%] mx-auto">
                          Esta guía técnica ha sido generada por Upcontrol, con herramientas e información disponible públicamente. Para dudas o consultas contáctese con nosotros.
                        </p>
                      </div>

                      <ReportFooter />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6 w-full max-w-2xl no-print pb-20">
                  <div className="flex flex-wrap justify-center gap-4">
                    <button onClick={handleDownloadPDF} className="bg-slate-900 text-white px-8 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black shadow-xl flex items-center gap-3 transition-all flex-1 min-w-[240px]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      Descargar Informe Técnico (PDF A4)
                    </button>
                    <button onClick={handleNewAnalysis} className="bg-white border-2 border-slate-900 text-slate-900 px-8 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all flex-1 min-w-[200px]">Nuevo Análisis</button>
                  </div>

                  <div className="bg-white p-8 rounded-[30px] border border-slate-200 shadow-sm flex flex-col items-center text-center gap-6">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">¿Deseas profundizar en estos resultados?</h4>
                    <div className="flex flex-wrap justify-center gap-4 w-full">
                      <a href={CALENDAR_LINK} target="_blank" className="flex-1 min-w-[200px] bg-[#991B1B] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-md flex items-center justify-center gap-3">
                         Agendar Cita de Consultoría
                      </a>
                      <a href={WHATSAPP_LINK} target="_blank" className="flex-1 min-w-[200px] bg-[#25D366] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#128C7E] transition-all shadow-md flex items-center justify-center gap-3">
                         Soporte Directo por WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer className="w-full py-12 border-t bg-white mt-auto text-center no-print">
        <UpcontrolLogo sizeClass="text-xl opacity-30 mb-4" />
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300">© 2026 Upcontrol S.A. - Especialistas en Gestión de Calidad</p>
      </footer>
    </div>
  );
};

export default App;
