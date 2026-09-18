import { createShellModel } from '../shared/packages/ui-shell/src/index.js';

export const agroTheme = Object.freeze({
  primary: '#24513B',
  primaryHover: '#1D4230',
  secondary: '#3F7D58',
  sand: '#D8C7A3',
  earth: '#8A5A3B',
  background: '#F7F5EF',
  surface: '#FFFFFF',
  border: '#E4DED1',
  text: '#27332C',
  muted: '#6B756E',
  success: '#15803D',
  info: '#2563EB',
  warning: '#D97706',
  danger: '#B91C1C'
});

const navigation = Object.freeze([
  { id: 'overview', label: 'Visão Geral', icon: 'dashboard' },
  { id: 'fields', label: 'Talhões', icon: 'map' },
  { id: 'seasons', label: 'Safras', icon: 'sprout' },
  { id: 'operations', label: 'Operações', icon: 'clipboard-list' },
  { id: 'inputs', label: 'Insumos', icon: 'package' },
  { id: 'harvest', label: 'Colheita', icon: 'wheat' },
  { id: 'inventory', label: 'Estoque', icon: 'warehouse' },
  { id: 'finance', label: 'Custos e Financeiro', icon: 'wallet' },
  { id: 'reports', label: 'Relatórios', icon: 'chart' },
  { id: 'settings', label: 'Configurações', icon: 'settings' }
]);

export function createAgroShellModel({ capabilities = [] } = {}) {
  return createShellModel({
    brand: {
      name: 'ArtiSys Agro Lavoura',
      productName: 'ArtiSys Agro Lavoura',
      theme: agroTheme,
      frontendPattern: 'desktop-admin',
      mobilePattern: 'mobile-operational'
    },
    capabilities,
    navigation
  });
}
