import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProfissionalForm from './components/ProfissionalForm';

interface UBS { id_ubs: string; nome_ubs: string; }

export default function CadastroProfissional() {
  const { ubsAtiva } = useAuth();
  const navigate = useNavigate();
  const [ubsList, setUbsList] = useState<UBS[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    const carregarUbs = async () => {
      try {
        const res = await api.get('/ubs/');
        setUbsList(res.data);
      } catch (e) { console.error('Erro ao carregar UBSs', e); }
    };
    carregarUbs();
  }, [ubsAtiva]);

  const handleCadastrar = async (dados: any) => {
    setErro('');
    setSucesso('');

    // Validações básicas
    if (dados.cpf.length !== 11) return setErro('CPF deve conter 11 dígitos.');
    if (!dados.senha || dados.senha.length < 8) return setErro('Senha deve ter no mínimo 8 caracteres.');
    if (!dados.idUbs) return setErro('A vinculação à uma Unidade de Saúde é obrigatória.');
    
    if (!dados.permissoes.medico && !dados.permissoes.recepcao && !dados.permissoes.is_gestor_local) {
      return setErro('Selecione pelo menos um perfil de acesso para o usuário.');
    }

    setLoading(true);
    try {
      await api.post('/profissionais/', {
        nome: dados.nome,
        cpf: dados.cpf,
        senha: dados.senha,
        id_ubs: dados.idUbs,
        registro_conselho: dados.conselho || undefined,
        id_especialidade: dados.id_especialidade || undefined
      });

      // No cadastro Nível 3 (via Gestor Local), o back-end cria com permissões default.
      // Se precisarmos atualizar as permissões imediatamente para algo customizado, 
      // teríamos que fazer um segundo PUT ou alterar o backend POST.
      // Por enquanto, seguimos o fluxo padrão de criação.

      setSucesso(`Profissional "${dados.nome}" cadastrado com sucesso!`);
      setTimeout(() => navigate('/admin/profissionais'), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao cadastrar profissional. Verifique se o CPF já existe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProfissionalForm
      ubsList={ubsList}
      loading={loading}
      erro={erro}
      sucesso={sucesso}
      onSubmit={handleCadastrar}
      onCancel={() => navigate('/admin/profissionais')}
    />
  );
}