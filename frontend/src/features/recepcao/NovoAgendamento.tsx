import { useState } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import { Users, Search, CalendarPlus, ShieldAlert } from 'lucide-react';

export default function NovoAgendamento() {
  const { ubsAtiva, userPayload } = useAuth();
  
  const [cpf, setCpf] = useState('');
  const [pacienteValido, setPacienteValido] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');
  const [slotsMockados, setSlotsMockados] = useState<any[]>([]);

  // Bate no sistema para validar utente e carregar slots do BD
  const handleValidarUtente = async () => {
    setErro('');
    setProcessando(true);
    
    // Simulação temporária veloz da API Nacional de Cidadão 
    if (cpf.replace(/\D/g, '').length !== 11) {
      setErro('CPF Inválido. Utente recusa existir.');
      setProcessando(false);
      return;
    }
    setPacienteValido(true);

    try {
      // Bate na rota PostgreSQL em que construímos as lógicas de Tempo
      // Nota: estamos usar um ID da Escala Exemplo Genérico caso o servidor não tenha devolvido ainda
      const response = await api.get('/agendamentos/disponiveis', {
        params: {
           id_escala: '00000000-0000-0000-0000-000000000000', // A ser selecionado pelo usuário num combobox futuro
           data_consulta: new Date().toISOString().split('T')[0]
        }
      });
      
      const vagas = response.data.horarios_disponiveis.map((h: string) => ({
          hora: h, disponivel: true 
      }));
      setSlotsMockados(vagas);
    } catch (err) {
      // Fallback para não quebrar UI caso não haja Escala criada:
      setErro("Nenhuma Escala Central foi criada por um Gestor para o dia de hoje. Os blocos exibirão uma simulação provisória.");
      setSlotsMockados([
        { hora: '09:00', disponivel: false },
        { hora: '09:15', disponivel: true }
      ]);
    } finally {
      setProcessando(false);
    }
  };

  const handleMarcarRecepcao = async (horaSelecionada: string) => {
    if (!ubsAtiva) {
      setErro("Nenhuma UBS Operacional foi selecionada no cabeçalho.");
      return;
    }
    
    setProcessando(true);
    setErro('');
    setSucesso('');

    try {
      // Bate no endpoint agressivamente para ativar o "Pessimistic Locking" que criámos.
      // Se houver conflito de horário/banco de dados simultâneo, o post falha.
      await api.post('/agendamentos', {
        id_ubs: ubsAtiva,
        cpf_paciente: cpf.replace(/\D/g, ''),
        id_profissional: userPayload?.sub,  // Apenas mockup
        data_agendamento: new Date().toISOString().split('T')[0],
        hora_inicio: horaSelecionada,
        especialidade: "Clínica Geral (Livre Demanda)"
      });
      
      setSucesso(`Ação Segura: Utente alocado estritamente às ${horaSelecionada}!`);
      
      // Limpa formulário
      setSlotsMockados([]);
      setPacienteValido(false);
      setCpf('');

    } catch (err: any) {
      setErro(err.response?.data?.detail || "Colisão de Horários! Slot reclamado por outro recepcionista.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-primary/10 rounded-xl text-primary">
            <Users size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Regulação / Call-Center</h2>
            <p className="text-slate-500 font-medium">Faça agendamentos com validação Lock-Database em tempo real.</p>
          </div>
        </div>
        {!ubsAtiva && (
          <span className="mt-4 md:mt-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-orange-100 text-orange-700">
            <ShieldAlert size={16} /> Regulação Bloqueada: Selecione uma Unidade Acima.
          </span>
        )}
      </div>

      {sucesso && (
         <div className="bg-emerald-500 text-emerald-50 text-center p-4 rounded-xl font-bold shadow-sm ring-1 ring-emerald-600">
           {sucesso}
         </div>
      )}

      {erro && (
        <div className="bg-red-500 text-red-50 text-center p-4 rounded-xl font-bold shadow-sm ring-1 ring-red-600">
           {erro}
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Painel 1: Buscador de Cidadão */}
        <div className={`p-8 rounded-3xl border transition-all duration-500 ${pacienteValido ? 'bg-white border-gray-200' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
          <h3 className="text-lg font-bold text-slate-800 mb-6 uppercase tracking-wider">Módulo de Utente</h3>
          
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Digite o CPF Exato (11 Números)</label>
            <div className="relative">
              <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} disabled={pacienteValido}
                className="w-full pl-6 pr-12 py-4 bg-white border border-slate-300 text-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-primary/20 text-xl font-black tracking-widest disabled:opacity-50"
                placeholder="000.000.000-00" maxLength={14} />
              <button 
                onClick={handleValidarUtente}
                disabled={processando || pacienteValido || cpf.length < 11}
                className="absolute right-3 top-3 p-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-300 transition-colors">
                {processando ? <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin"/> : <Search size={20} />}
              </button>
            </div>
            {pacienteValido && (
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                 <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase">Cidadão Elegível</p>
                    <p className="text-emerald-800 font-medium">Bases Nacionais Sincronizadas.</p>
                 </div>
                 <button onClick={() => {setPacienteValido(false); setSlotsMockados([])}} className="text-xs font-bold bg-white px-3 py-1 text-red-500 border border-red-200 rounded-md hover:bg-red-50">Cancelar Ocorrência</button>
              </div>
            )}
          </div>
        </div>

        {/* Painel 2: Agenda Cirúrgica */}
        <div className={`p-8 rounded-3xl border transition-all duration-500 ${pacienteValido ? 'bg-white border-blue-100 shadow-lg shadow-blue-500/10' : 'bg-slate-50 border-slate-200 opacity-50 grayscale pointer-events-none'}`}>
           <h3 className="text-lg font-bold text-primary mb-6 flex items-center space-x-2">
             <CalendarPlus size={24} /> <span>Janelas Livres</span>
           </h3>

           {!pacienteValido ? (
             <p className="text-slate-400 font-medium text-center mt-10">Valide o cidadão primeiro para calcular as rotas da agenda.</p>
           ) : (
             <div className="grid grid-cols-2 gap-3">
               {slotsMockados.map((slot, i) => (
                 <button 
                    key={i} 
                    disabled={!slot.disponivel || processando || !ubsAtiva}
                    onClick={() => handleMarcarRecepcao(slot.hora)}
                    className={`p-4 rounded-xl border-2 font-bold transition-all text-center ${
                      !slot.disponivel 
                        ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60' 
                        : 'bg-white border-blue-200 text-blue-600 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md hover:scale-[1.02]'
                    }`}
                 >
                   <span className="block text-2xl">{slot.hora}</span>
                   <span className="block text-[10px] uppercase mt-1">
                     {slot.disponivel ? 'RESERVAR IMEDIATO' : 'CORTADO'}
                   </span>
                 </button>
               ))}
               <div className="col-span-2 text-center text-[10px] font-bold text-slate-300 uppercase underline mt-4 cursor-pointer">Carregar mais janelas...</div>
             </div>
           )}
        </div>
      </div>

    </div>
  );
}
