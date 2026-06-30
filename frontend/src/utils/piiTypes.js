/**
 * PII type definitions — colours, labels, and icons for each category.
 */

export const PII_TYPES = {
  NAME: {
    label: 'Person Name',
    color: '#64b5f6',
    bg: 'rgba(100,181,246,0.12)',
    icon: '👤',
  },
  EMAIL: {
    label: 'Email Address',
    color: '#ffab40',
    bg: 'rgba(255,171,64,0.12)',
    icon: '📧',
  },
  PHONE: {
    label: 'Phone Number',
    color: '#66bb6a',
    bg: 'rgba(102,187,106,0.12)',
    icon: '📱',
  },
  SSN: {
    label: 'Social Security #',
    color: '#ef5350',
    bg: 'rgba(239,83,80,0.12)',
    icon: '🔐',
  },
  ADDRESS: {
    label: 'Physical Address',
    color: '#ce93d8',
    bg: 'rgba(206,147,216,0.12)',
    icon: '📍',
  },
  MEDICAL_ID: {
    label: 'Medical Record',
    color: '#4dd0e1',
    bg: 'rgba(77,208,225,0.12)',
    icon: '🏥',
  },
  FINANCIAL: {
    label: 'Financial Info',
    color: '#ffd54f',
    bg: 'rgba(255,213,79,0.12)',
    icon: '💳',
  },
  EMPLOYEE_ID: {
    label: 'Employee ID',
    color: '#90a4ae',
    bg: 'rgba(144,164,174,0.12)',
    icon: '🪪',
  },
  DATE_OF_BIRTH: {
    label: 'Date of Birth',
    color: '#f48fb1',
    bg: 'rgba(244,143,177,0.12)',
    icon: '📅',
  },
  OTHER: {
    label: 'Other PII',
    color: '#b0bec5',
    bg: 'rgba(176,190,197,0.12)',
    icon: '⚠️',
  },
};

export function getTypeInfo(type) {
  return PII_TYPES[type] || PII_TYPES.OTHER;
}

export function getRiskColor(level) {
  switch (level) {
    case 'HIGH':   return '#ef5350';
    case 'MEDIUM': return '#ffab40';
    case 'LOW':    return '#66bb6a';
    default:       return '#90a4ae';
  }
}
