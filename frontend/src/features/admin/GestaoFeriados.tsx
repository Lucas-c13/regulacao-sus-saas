import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { CalendarX, Plus, Trash2, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Shared Components
import { PremiumHeader } from '../../shared/components/PremiumHeader';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';
import { StatusBadge } from '../../shared/components/StatusBadge';

interface Feriado {
    id_feriado: string;
    data: string;
    descricao: string;
    tipo: 'municipal' | 'estadual' | 'nacional' | 'ponto_facultativo';
}

export default function GestaoFeriados() {
    const [feriados, setFeriados] = useState<Feriado[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [erro, setErro] = useState('');

    // Estados do formulário
    const [novaData, setNovaData] = useState('');
    const [novaDescricao, setNovaDescricao] = useState('');
    const [novoTipo, setNovoTipo] = useState<Feriado['tipo']>('municipal');

    const carregarFeriados = async () => {
        try {
            setLoading(true);
            setErro('');
            const response = await api.get('/feriados/');
            setFeriados(response.data);
        } catch (error) {
            setErro('Não foi possível carregar a lista de feriados locais.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarFeriados();
    }, []);

    const handleAdicionar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!novaData || !novaDescricao) return;

        try {
            setSubmitting(true);
            await api.post('/feriados/', {
                data: novaData,
                descricao: novaDescricao,
                tipo: novoTipo
            });

            toast.success('Feriado bloqueado com sucesso!');
            setNovaData('');
            setNovaDescricao('');
            setNovoTipo('municipal');
            carregarFeriados();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Erro ao adicionar feriado.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemover = async (id: string) => {
        if (!window.confirm('Deseja realmente liberar esta data na agenda?')) return;

        try {
            setLoading(true);
            await api.delete(`/feriados/${id}`);
            toast.success('Bloqueio removido.');
            carregarFeriados();
        } catch (error) {
            toast.error('Erro ao remover o feriado.');
        } finally {
            setLoading(false);
        }
    };

    const formatarData = (dataIso: string) => {
        const [ano, mes, dia] = dataIso.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            
            <PremiumHeader 
                icon={CalendarX}
                title="Gestão de Calendário"
                subtitle="Cadastre feriados municipais ou pontos facultativos para travar agendamentos."
            />

            {erro && (
                <div className="bg-red-50 text-red-600 p-5 rounded-2xl flex items-center gap-3 border border-red-100 font-bold">
                    <AlertCircle size={20} />
                    {erro}
                </div>
            )}

            {/* Guia de uso */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex gap-4">
                <Info className="text-amber-500 shrink-0" size={24} />
                <div className="text-sm text-amber-800 font-medium leading-relaxed">
                    <p className="font-bold text-amber-900 mb-1">Como funciona o bloqueio?</p>
                    Datas cadastradas aqui impedem a geração de horários automáticos para todos os profissionais do município. 
                    Feriados nacionais já são bloqueados automaticamente pelo sistema.
                </div>
            </div>

            {/* Formulário */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 ml-1">Adicionar Novo Bloqueio Local</h3>
                <form onSubmit={handleAdicionar} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data do Evento</label>
                        <input
                            type="date"
                            required
                            value={novaData}
                            onChange={(e) => setNovaData(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all"
                        />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descrição (Motivo do Bloqueio)</label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Padroeira do Município"
                            value={novaDescricao}
                            onChange={(e) => setNovaDescricao(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-primary text-white h-[52px] rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? <LoadingSpinner size={18} className="p-0 text-white" /> : (
                            <>
                                <Plus size={18} />
                                <span>Bloquear Data</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Listagem */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {loading && feriados.length === 0 ? (
                    <LoadingSpinner label="Lendo calendário do município..." className="py-20" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                    <th className="p-6">Data</th>
                                    <th className="p-6">Descrição do Evento</th>
                                    <th className="p-6">Status da Agenda</th>
                                    <th className="p-6 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {feriados.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-20 text-center text-slate-400 font-bold italic">
                                            Nenhum bloqueio municipal ativo.
                                        </td>
                                    </tr>
                                ) : (
                                    feriados.map((f) => (
                                        <tr key={f.id_feriado} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-6 font-mono font-black text-slate-700 tracking-tighter">
                                                {formatarData(f.data)}
                                            </td>
                                            <td className="p-6 font-bold text-slate-800">
                                                {f.descricao}
                                            </td>
                                    <td className="p-6">
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge 
                                                        label={f.tipo.replace('_', ' ')} 
                                                        type={f.tipo === 'nacional' ? 'success' : 'neutral'} 
                                                    />
                                                    {f.tipo === 'nacional' && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Automático</span>}
                                                </div>
                                            </td>
                                            <td className="p-6 text-right">
                                                {f.id_feriado ? (
                                                    <button
                                                        onClick={() => handleRemover(f.id_feriado)}
                                                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Remover Bloqueio"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                ) : (
                                                    <div className="p-3 text-slate-200 cursor-not-allowed" title="Feriados nacionais não podem ser removidos.">
                                                        <Trash2 size={20} />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}