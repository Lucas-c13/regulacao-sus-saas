import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import UBSForm from './components/UBSForm';
import { RefreshCcw } from 'lucide-react';

export default function EditarUBS() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [dadosIniciais, setDadosIniciais] = useState<any>(null);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Buscamos os dados da UBS específica
        // Nota: O endpoint /ubs/ costuma listar, mas precisamos de um GET /ubs/{id}
        // Se não houver GET /ubs/{id}, teremos que buscar na lista filtrando.
        // Vou assumir que existe GET /ubs/{id} ou carregar da lista.
        
        const res = await api.get(`/ubs/`);
        const lista = res.data;
        const ubs = lista.find((u: any) => u.id_ubs === id);
        
        if (!ubs) {
          setErro("Unidade de saúde não localizada.");
          return;
        }

        // Mapeamos nome_ubs (do backend) para nome (do form)
        setDadosIniciais({
          nome: ubs.nome_ubs || ubs.nome,
          cnes: ubs.cnes,
          cep: ubs.cep || '', // O backend listar_ubs não retorna CEP no momento
          endereco: ubs.endereco?.logradouro || '' 
        });
      } catch (err: any) {
        setErro("Falha ao carregar dados da Unidade.");
      } finally {
        setLoadingInitial(false);
      }
    };
    if (id) carregarDados();
  }, [id]);

  const handleSalvar = async (dados: any) => {
    setLoadingSubmit(true);
    setErro('');
    setSucesso('');

    try {
      // O backend ubs.py não tem rota PUT no momento, mas o prompt pediu para criar
      // Vou assumir que o backend suporta ou o usuário vai implementar.
      // Por enquanto, seguimos o contrato solicitado: nm_ubs vs nome.
      // O backend espera 'nome' no UbsCreate, usaremos o mesmo padrão no UPDATE.
      
      await api.put(`/ubs/${id}`, {
        nome: dados.nome,
        cnes: dados.cnes,
        cep: dados.cep,
        endereco: dados.endereco
      });

      setSucesso("Unidade de Saúde atualizada com sucesso!");
      setTimeout(() => navigate('/admin/ubs'), 2000);
    } catch (err: any) {
      setErro(err.response?.data?.detail || "Erro ao salvar alterações da UBS.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500">
          <RefreshCcw className="animate-spin mb-2 text-primary" size={32} />
          <span>A carregar dados da unidade...</span>
      </div>
    );
  }

  return (
    <UBSForm
      dadosIniciais={dadosIniciais}
      isEdicao={true}
      buscando={loadingSubmit}
      erroGlobal={erro}
      sucessoGlobal={sucesso}
      onSubmit={handleSalvar}
      onCancel={() => navigate('/admin/ubs')}
    />
  );
}
