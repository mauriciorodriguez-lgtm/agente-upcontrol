
import { GoogleGenAI, Type } from "@google/genai";
import { UserInfo, ProductInfo, AnalysisResult, TariffSuggestion } from "../types";

export const registerUserLead = async (user: UserInfo, product?: ProductInfo): Promise<boolean> => {
  const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxFL77qrBGTL1svkbhjecwn9y_tp3EJbHv6MPPKLYQzbHOQKXXu0lLvcLA_a2rmLmUV/exec";

  const operationTypeMap = {
    import: 'Importación',
    export: 'Exportación',
    production: 'Producción para Consumo Nacional'
  };

  const leadData = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    product: product?.name || "Registro Inicial",
    operationType: product ? operationTypeMap[product.operationType] : "N/A",
    destinationCountry: product?.destinationCountry || "Ecuador",
    tariffCode: product?.tariffCode || "N/A",
    timestamp: new Date().toLocaleString('es-EC'),
    source: 'Upcontrol Quality Tool'
  };

  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });
    return true;
  } catch (error) {
    console.error("Error lead sync:", error);
    return false;
  }
};

export const analyzeProductQualityRequirements = async (
  user: UserInfo,
  product: ProductInfo
): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isExport = product.operationType === 'export';
  const targetMarket = isExport ? product.destinationCountry : 'Ecuador';
  
  const prompt = `
    Actúa como el Asesor Principal de Upcontrol S.A., experto en Infraestructura de la Calidad y Comercio Exterior.
    Realiza un análisis TÉCNICO PROFUNDO para: "${product.name}" (Partida: ${product.tariffCode}).
    Operación: ${product.operationType} | Mercado: ${targetMarket}

    INSTRUCCIONES CRÍTICAS DE EXCLUSIÓN:
    - NO USAR NI CITAR EL RTE INEN 080 NI EL RTE INEN 013 (YA QUE ESTÁN DEROGADOS).

    INSTRUCCIONES DE ANÁLISIS OBLIGATORIO:
    1. ETIQUETADO Y RTA: Si aplica (textil, calzado, etc.), cita Res. 2109 o 2107.
    2. REGLAMENTACIÓN TÉCNICA (RTE): Identifica el RTE vigente específico.
    3. NORMALIZACIÓN: Detalla normas NTE INEN, ISO o ASTM aplicables.
    4. ACREDITACIÓN: Describe el proceso de Certificación y organismos acreditados (SAE).
    5. METROLOGÍA: Controles de pesos y medidas.

    ESTRATEGIA DE COMPETITIVIDAD Y MEJORAMIENTO OPCIONALES:
    Genera 8 estrategias ejecutivas de alto valor. Para cada una, proporciona una explicación AMPLIA, DETALLADA y PROFESIONAL (mínimo 2-3 oraciones por cada punto).
    Los dos primeros puntos SIEMPRE deben ser:
    - Certificación ISO 9001:2015: Explica cómo impacta en la estandarización y confianza global.
    - Kaizen Mejoramiento Continuo: Explica cómo reduce costos operativos y optimiza recursos.

    FORMATO: Sé técnico, exhaustivo y profesional.
  `;

  const configBase = {
    thinkingConfig: { thinkingBudget: 32768 },
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        obligatoryRequirements: {
          type: Type.OBJECT,
          properties: {
            normalization: { type: Type.STRING },
            regulation: { type: Type.STRING },
            accreditation: { type: Type.STRING },
            metrology: { type: Type.STRING },
          },
          required: ["normalization", "regulation", "accreditation", "metrology"]
        },
        optionalRequirements: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "description"]
          }
        }
      },
      required: ["obligatoryRequirements", "optionalRequirements"]
    }
  };

  let rawResult: any;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { ...configBase, tools: [{ googleSearch: {} }] }
    });
    rawResult = JSON.parse(response.text || '{}');
  } catch (error) {
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: configBase
    });
    rawResult = JSON.parse(fallbackResponse.text || '{}');
  }

  const mandatoryUpcontrolStrategies = [
    { 
      title: "Certificación ISO 9001:2015", 
      description: "Implementación integral de un Sistema de Gestión de Calidad bajo estándares internacionales para garantizar la consistencia en el servicio, la trazabilidad absoluta de procesos y una mejora sustancial en la percepción de confianza por parte de mercados globales y clientes estratégicos." 
    },
    { 
      title: "Kaizen: Mejoramiento Continuo", 
      description: "Adopción de una cultura de optimización diaria basada en la eficiencia operativa, reduciendo drásticamente los costos ocultos por desperdicios (Muda) y potenciando la competitividad mediante el involucramiento directo de todo el personal en la excelencia de procesos." 
    }
  ];

  const filteredOptional = (rawResult.optionalRequirements || []).filter(
    (req: any) => !req.title.toLowerCase().includes("iso 9001") && !req.title.toLowerCase().includes("kaizen")
  );

  return {
    ...rawResult,
    optionalRequirements: [
      ...mandatoryUpcontrolStrategies,
      ...filteredOptional
    ],
    groundingSources: []
  };
};

export const suggestTariffCode = async (productName: string): Promise<TariffSuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Actúa como experto en aduanas SENAE. Sugiere 3 partidas arancelarias de 10 dígitos para: "${productName}".`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              name: { type: Type.STRING }
            },
            required: ["code", "name"]
          }
        },
        tools: [{ googleSearch: {} }]
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    return [];
  }
};
