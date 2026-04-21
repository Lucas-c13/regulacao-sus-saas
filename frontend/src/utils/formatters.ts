/**
 * Utilitários Globais de Formatação
 */

export const formatarCPF = (valor: string | null | undefined): string => {
  if (!valor) return '';
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const formatarData = (isoDate: string | null | undefined): string => {
  if (!isoDate) return 'Não Informada';
  const partes = isoDate.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return isoDate;
};

export const formatarCNS = (valor: string | null | undefined): string => {
  if (!valor) return 'Não Informado';
  const nums = valor.replace(/\D/g, '').slice(0, 15);
  return nums.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
};
