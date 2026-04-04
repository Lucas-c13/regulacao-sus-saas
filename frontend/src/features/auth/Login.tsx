import { useState, useEffect } from 'react';
import { useAuth } from '../../core/AuthContext';
import { api } from '../../core/api';

interface Vinculo {
  id_municipio: string;
  nome_municipio: string;
}

export default function Login() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [idMunicipioSelecionado, setIdMunicipioSelecionado] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [buscandoMunicipios, setBuscandoMunicipios] = useState(false);
  
  const { login } = useAuth();

  // Limpa tudo o que não for número para sabermos se o CPF está completo
  const cpfLimpo = cpf.replace(/\D/g, '');

  // O "Cérebro" invisível: Monitoriza o CPF enquanto o usuário digita
  useEffect(() => {
    const buscarMunicipios = async () => {
      // Quando bater 11 números, vai ao backend buscar as prefeituras dele
      if (cpfLimpo.length === 11) {
        setBuscandoMunicipios(true);
        setErro('');
        try {
          const response = await api.post('/auth/verificar-acessos', { cpf: cpfLimpo });
          const listaVinculos = response.data.vinculos;
          
          setVinculos(listaVinculos);
          setIdMunicipioSelecionado(listaVinculos[0].id_municipio);
        } catch (error: any) {
          setVinculos([]);
          setErro('CPF não possui acessos registrados.');
        } finally {
          setBuscandoMunicipios(false);
        }
      } else {
        // Se apagar um número, esconde os municípios novamente
        setVinculos([]);
        setIdMunicipioSelecionado('');
      }
    };

    buscarMunicipios();
  }, [cpfLimpo]);

  const handleLoginFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      await login(cpfLimpo, senha, idMunicipioSelecionado);
    } catch (error) {
      setErro('Credenciais incorretas. Verifique sua senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-surface p-8 rounded-xl shadow-md w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Regulação SUS</h1>
          <p className="text-textMain text-sm">Acesso ao Painel da Unidade</p>
        </div>

        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center font-medium">
            {erro}
          </div>
        )}

        <form onSubmit={handleLoginFinal} className="space-y-5">
          {/* CAMPO 1: CPF */}
          <div>
            <label className="block text-sm font-medium text-textMain mb-1">CPF</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="Digite os 11 números"
              maxLength={14}
              required
            />
          </div>

          {/* CAMPO 2: SENHA */}
          <div>
            <label className="block text-sm font-medium text-textMain mb-1">Senha</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {/* CAMPO 3: MUNICÍPIO (Aparece sozinho quando o CPF está completo) */}
          <div className={`transition-all duration-300 ${vinculos.length > 0 ? 'opacity-100 h-auto' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-sm font-medium text-textMain mb-1">
              {buscandoMunicipios ? 'A localizar município...' : 'Município'}
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white disabled:bg-gray-100"
              value={idMunicipioSelecionado}
              onChange={(e) => setIdMunicipioSelecionado(e.target.value)}
              disabled={vinculos.length === 0}
              required
            >
              {vinculos.length === 0 && <option value="">Aguardando CPF...</option>}
              {vinculos.map((v) => (
                <option key={v.id_municipio} value={v.id_municipio}>
                  {v.nome_municipio}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || vinculos.length === 0}
            className="w-full bg-primary hover:bg-secondary text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? 'A entrar...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}