import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import ProfissionalForm from './components/ProfissionalForm';
import { Activity } from 'lucide-react';

interface UBS { id_ubs: string; nome_ubs: string; }

export default function EditarProfissional() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ubsList, setUbsList] = useState<UBS[]>([]);
  const [dadosIniciais, setDadosIniciais] = useState<any>(null);
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    const carregarDadosBase = async () => {
      try {
        const resUbs = await api.get('/ubs/');
        setUbsList(resUbs.data || []);

        const resProf = await api.get(`/profissionais/${id}`);
        const p = resProf.data;

        setDadosIniciais({
          idUbs: p.id_ubs,
          nome: p.nome,
          cpf: p.cpf,
          conselho: p.conselho,
          id_especialidade: p.id_especialidade,
          permissoes: p.permissoes
        });
      } catch (e: any) {
        setErro(e.response?.data?.detail || 'Erro ao carregar dados do profissional.');
      } finally {
        setLoadingInitial(false);
      }
    };
    if (id) {
        carregarDadosBase();
    }
  }, [id]);

  const handleAtualizar = async (dados: any) => {
    setErro('');
    setSucesso('');

    if (!dados.permissoes.medico && !dados.permissoes.recepcao && !dados.permissoes.is_gestor_local) {
      return setErro('Selecione pelo menos um perfil de acesso.');
    }

    setLoadingSubmit(true);
    try {
      await api.put(`/profissionais/${id}`, {
        nome: dados.nome,
        conselho: dados.conselho || undefined,
        id_especialidade: dados.id_especialidade || undefined,
        permissoes: dados.permissoes // Dict exato esperado pelo backend
      });

      setSucesso(`Profissional "${dados.nome}" atualizado com sucesso!`);
      setTimeout(() => navigate('/admin/profissionais'), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao atualizar profissional.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 font-medium space-x-3">
          <Activity className="animate-spin text-primary" size={24} />
          <span>A buscar dados do profissional...</span>
      </div>
    );
  }

  return (
    <ProfissionalForm
      ubsList={ubsList}
      dadosIniciais={dadosIniciais}
      isEdicao={true}
      loading={loadingSubmit}
      erro={erro}
      sucesso={sucesso}
      onSubmit={handleAtualizar}
      onCancel={() => navigate('/admin/profissionais')}
    />
  );
}
