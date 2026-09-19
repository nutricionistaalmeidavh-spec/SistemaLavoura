import { createShellModel } from '../shared/packages/ui-shell/src/index.js';

export const agroTheme = Object.freeze({
  primary: '#24513B',
  primaryHover: '#1D4230',
  primarySoft: '#DDEEE2',
  secondary: '#3F7D58',
  sand: '#D8C7A3',
  earth: '#8A5A3B',
  background: '#F4F7F4',
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAF8',
  surfaceAccent: '#EDF6EF',
  surfaceMuted: '#F0F4F1',
  sidebar: '#F8FBF8',
  border: '#E1E8E2',
  borderStrong: '#CCD8CF',
  text: '#17221B',
  muted: '#66736B',
  success: '#15803D',
  info: '#2563EB',
  warning: '#C47B09',
  danger: '#B42318',
  radiusCard: '18px',
  radiusControl: '12px',
  shadowCard: '0 10px 30px rgba(31, 65, 46, 0.07)',
  shadowFloating: '0 18px 50px rgba(20, 48, 32, 0.14)'
});

const navigation = Object.freeze([
  { id: 'overview', label: 'Dashboard', icon: 'dashboard', group: 'Visão geral' },
  { id: 'fields', label: 'Talhões', icon: 'map', group: 'Produção' },
  { id: 'seasons', label: 'Safras', icon: 'sprout', group: 'Produção' },
  { id: 'operations', label: 'Operações', icon: 'clipboard-list', group: 'Produção' },
  { id: 'inputs', label: 'Insumos', icon: 'package', group: 'Produção' },
  { id: 'harvest', label: 'Colheita', icon: 'wheat', group: 'Produção' },
  { id: 'inventory', label: 'Estoque', icon: 'warehouse', group: 'Gestão' },
  { id: 'finance', label: 'Custos e Financeiro', icon: 'wallet', group: 'Gestão' },
  { id: 'reports', label: 'Relatórios', icon: 'chart', group: 'Gestão' },
  { id: 'settings', label: 'Configurações', icon: 'settings', group: 'Sistema' }
]);

export function createAgroShellModel({ capabilities = [] } = {}) {
  return createShellModel({
    brand: {
      name: 'ArtiSys Agro Lavoura',
      productName: 'Sistema Lavoura',
      theme: agroTheme,
      frontendPattern: 'frontEnds/shells/desktop-admin',
      mobilePattern: 'frontEnds/shells/mobile-operational'
    },
    capabilities,
    navigation
  });
}
