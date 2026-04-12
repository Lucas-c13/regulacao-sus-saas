import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { Users, Search, Activity, UserCog } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Profissional {
  id_profissional: string;
  nome: string;
  cpf: string;
  sn_ativo: boolean;
}

export default function ListaProfissionais() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const carregarTabela = async () => {
      try {
        const response = await api.get('/profissionais/municipio');
        setProfissionais(response.data);
      } catch (error) {
        setErro('Falha ao carregar a Mesa de Controle dos Profissionais.');
      } finally {
        setLoading(false);
      }
    };
    
    carregarTabela();
  }, []);

  const profissionaisFiltrados = profissionais.filter(p => 
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.cpf.includes(busca)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Premium */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-primary/10 rounded-xl text-primary">
            <Users size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Meus Profissionais</h2>
            <p className="text-slate-500 font-medium">Mesa de controle de acessos e médicos geridos pelo Município.</p>
          </div>
        </div>
        <div>
          <button 
             onClick={() => navigate('/admin/profissionais/novo')}
             className="bg-primary hover:bg-secondary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
             <UserCog size={18} /> Cadastrar Novo
          </button>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        
        {/* Barra de Pesquisa */}
        <div className="mb-8 relative">
          <input 
            type="text" 
            placeholder="Pesquisar por Nome ou CPF..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Search className="absolute left-4 top-4 text-slate-400" size={24} />
        </div>

        {erro && (
           <div className="mb-6 bg-red-50 text-red-600 rounded-lg p-4 font-semibold">{erro}</div>
        )}

        {/* Tabela de Dados */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-5">Nome do Profissional</th>
                <th className="p-5">C.P.F.</th>
                <th className="p-5">Estado</th>
                <th className="p-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                    <Activity className="animate-spin mx-auto mb-2 text-primary" />
                    A carregar a Matriz do Município...
                  </td>
                </tr>
              ) : profissionaisFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold">
                    Nenhum profissional encontrado nesta malha de pesquisa.
                  </td>
                </tr>
              ) : (
                profissionaisFiltrados.map((p) => (
                  <tr key={p.id_profissional} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 font-bold text-slate-800">{p.nome}</td>
                    <td className="p-5 font-medium text-slate-500 tracking-wider">
                      {p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                    </td>
                    <td className="p-5">
                      {p.sn_ativo ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                           🟢 Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                           🔴 Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-right">
                      <button className="text-sm font-bold text-primary hover:text-secondary hover:underline transition-colors">
                         Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
