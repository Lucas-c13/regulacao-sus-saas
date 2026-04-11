import { useState } from 'react';
import { api } from '../../core/api';
import { HeartPulse, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

export default function CadastroPaciente() {
  const { ubsAtiva, userPayload } = useAuth();
  
  const [nome, setNome] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [cpf, setCpf] = useState('');
  const [cns, setCns] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState('M');
  const [aceitouLGPD, setAceitouLGPD] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);

    if (!aceitouLGPD) {
      setErro('Obrigatório obter consentimento Lei Geral de Proteção de Dados do Cidadão.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/pacientes/', {
        id_municipio: userPayload?.id_municipio,
        id_ubs_referencia: ubsAtiva || null,
        nr_cpf: cpf.replace(/\D/g, '') || null,
        nr_cns: cns.replace(/\D/g, '') || null,
        nm_paciente: nome,
        nm_mae: nomeMae || null,
        dt_nascimento: dataNascimento,
        tp_sexo: sexo
      });

      setSucesso(true);
      setNome(''); setNomeMae(''); setCpf(''); setCns(''); 
      setDataNascimento(''); setAceitouLGPD(false);
    } catch (err: any) {
      setErro(err.response?.data?.detail || "Erro de integridade ao registar Cidadão na Base.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <HeartPulse size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Admissão de Cidadão</h2>
          <p className="text-slate-500 font-medium">Guarde permanentemente o Registo de Utentes para rápido agendamento.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        
        {sucesso && (
           <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl flex items-center space-x-3">
             <CheckCircle2 className="text-emerald-500" />
             <span className="font-semibold">Cidadão Salvo! Já pode aceder ao ecrã Novo Agendamento e marcar a sua vaga.</span>
           </div>
        )}

        {erro && (
           <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
             <ShieldAlert className="text-red-500" />
             <span className="font-semibold">{erro}</span>
           </div>
        )}

        <form onSubmit={handleCadastrar} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome Completo</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
                placeholder="Ex: João Miguel Santos" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome da Mãe</label>
              <input type="text" value={nomeMae} onChange={e => setNomeMae(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
                placeholder="Indispensável para o Cartão SUS" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">CPF</label>
              <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} maxLength={14}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold tracking-widest"
                placeholder="000.000.000-00" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Cartão Nacional do SUS</label>
              <input type="text" value={cns} onChange={e => setCns(e.target.value)} maxLength={18}
                className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-bold tracking-widest"
                placeholder="700.0000.0000.0000" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Data de Nascimento</label>
              <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sexo de Registo</label>
              <select value={sexo} onChange={e => setSexo(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold">
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

          </div>

          <label className="flex items-start space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
             <input type="checkbox" checked={aceitouLGPD} onChange={e => setAceitouLGPD(e.target.checked)} className="mt-1 w-5 h-5 text-primary rounded" />
             <div className="text-sm text-slate-600">
               <span className="font-bold text-slate-800 block">Consentimento de Dados (LGPD)</span>
               Eu atesto legalmente que o cidadão acima concordou verbalmente com o armazenamento dos seus dados pessoais. O nosso Back-end carimbará o registo desta permissão.
             </div>
          </label>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={loading}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
              {loading ? 'A FECHAR FICHA...' : 'GUARDAR CIDADÃO NA BASE'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
