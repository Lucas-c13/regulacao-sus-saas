import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { UserCheck, Clock, XCircle, AlertCircle } from 'lucide-react';

interface PacienteAgenda {
  id_item: string;
  hora: string;
  status: string;
  // Como o nosso backend MVP atual retorna apenas a hora e o status,
  // vamos simular um nome de paciente para o painel não ficar vazio.
  nome_ficticio?: string; 
}

interface DadosAgenda {
  medico: string;
  data: string;
  total_pacientes: number;
  pacientes: PacienteAgenda[];
}

export default function AgendaDia() {
  const [agenda, setAgenda] = useState<DadosAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const buscarAgenda = async () => {
    try {
      const response = await api.get('/agendamentos/minha-agenda');
      
      // Adicionando nomes fictícios apenas para efeito visual no MVP
      const nomes = ["Maria Silva", "João Santos", "Ana Oliveira", "Carlos Souza", "Beatriz Costa"];
      const dados = response.data;
      dados.pacientes = dados.pacientes.map((p: any, index: number) => ({
        ...p,
        nome_ficticio: nomes[index % nomes.length]
      }));

      setAgenda(dados);
    } catch (error) {
      setErro('Não foi possível carregar a agenda de hoje.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (id_item: string) => {
    try {
      // Chama o backend para alterar o status para 'A' (Chegou/Aguardando)
      await api.patch(`/agendamentos/${id_item}/status`, {
        novo_status: 'A'
      });
      
      // Atualiza a tabela na tela sem precisar recarregar a página!
      buscarAgenda();
    } catch (error) {
      alert("Erro ao realizar o check-in do paciente.");
    }
  };

  useEffect(() => {
    buscarAgenda();
  }, []);

  // Função utilitária para desenhar a "Pílula" (Badge) de Status
  const renderizarStatus = (status: string) => {
    switch (status) {
      case 'M':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
            <Clock size={14} /> Marcado
          </span>
        );
      case 'A':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <UserCheck size={14} /> Aguardando (Check-in)
          </span>
        );
      case 'F':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <AlertCircle size={14} /> Faltou
          </span>
        );
      case 'C':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            <XCircle size={14} /> Cancelado
          </span>
        );
      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-textMain animate-pulse font-medium">A carregar a agenda do dia...</div>;
  }

  if (erro) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg font-medium">{erro}</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Cabeçalho do Card */}
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-xl font-bold text-textMain">Agenda de Hoje</h2>
          <p className="text-sm text-gray-500 mt-1">
            Profissional: <span className="font-semibold text-primary">{agenda?.medico}</span>
          </p>
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold">
          {agenda?.total_pacientes} Pacientes
        </div>
      </div>

      {/* Tabela Sênior e Limpa */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <th className="p-4 pl-6">Horário</th>
              <th className="p-4">Cidadão</th>
              <th className="p-4">Situação</th>
              <th className="p-4 text-right pr-6">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agenda?.pacientes.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  Nenhum paciente agendado para hoje.
                </td>
              </tr>
            ) : (
              agenda?.pacientes.map((paciente, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="p-4 pl-6 font-semibold text-textMain">
                    {paciente.hora}
                  </td>
                  <td className="p-4 text-textMain font-medium">
                    {paciente.nome_ficticio}
                  </td>
                  <td className="p-4">
                    {renderizarStatus(paciente.status)}
                  </td>
                  <td className="p-4 text-right pr-6">
                    {paciente.status === 'M' && (
                    <button 
                        onClick={() => handleCheckIn(paciente.id_item)}
                        className="bg-primary hover:bg-secondary text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-colors opacity-0 group-hover:opacity-100"
                    >
                        Fazer Check-in
                    </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}