
export interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface ProductInfo {
  name: string;
  tariffCode: string;
  operationType: 'import' | 'export' | 'production';
  destinationCountry?: string;
}

export interface OptionalRequirement {
  title: string;
  description: string;
}

export interface TariffSuggestion {
  code: string;
  name: string;
}

export interface AnalysisResult {
  obligatoryRequirements: {
    normalization: string;
    regulation: string;
    accreditation: string;
    metrology: string;
  };
  optionalRequirements: OptionalRequirement[];
  groundingSources: Array<{
    web?: { uri: string; title: string };
  }>;
}
