import { useState } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import UBSForm from './components/UBSForm';

export default function CadastroUBS() {
  const { userPayload } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState<boolean | string>(false);

  const handleCadastrar = async (dados: any) => {
    setErro('');
    setSucesso(false);
    setLoading(true);

    try {
      await api.post('/ubs/', {
        id_municipio: userPayload?.id_municipio || userPayload?.tenant_id,
        nome: dados.nome,
        cnes: dados.cnes,
        cep: dados.cep,
        endereco: dados.endereco
      });

      setSucesso(true);
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro crítico ao registar Unidade de Saúde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <UBSForm
      buscando={loading}
      erroGlobal={erro}
      sucessoGlobal={sucesso}
      onSubmit={handleCadastrar}
    />
  );
}
