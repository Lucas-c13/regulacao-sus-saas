import { useState, useEffect } from 'react';
import { Search, Building2, Plus, Power, PowerOff, Edit, MapPin, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api } from '../../core/api';

// Shared Components
import { PremiumHeader } from '../../shared/components/PremiumHeader';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

interface UBS {
    id_ubs: string;
    nome_ubs: string;
    cnes: string;
    sn_ativo: boolean;
    endereco?: {
        logradouro?: string;
        bairro?: string;
    };
    cep?: string;
}

export const ListaUBS = () => {
    const [ubsList, setUbsList] = useState<UBS[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    const carregarUbs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/ubs/');
            setUbsList(res.data);
        } catch (error) {
            toast.error("Erro ao carregar a lista de unidades de saúde.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarUbs();
    }, []);

    const handleToggleStatus = async (id_ubs: string, statusAtual: boolean) => {
        const novoStatus = !statusAtual;
        const acao = novoStatus ? 'ativar' : 'inativar';

        toast.promise(
            api.patch(`/ubs/${id_ubs}`, { sn_ativo: novoStatus }),
            {
                loading: `A ${acao} unidade...`,
                success: `Unidade ${novoStatus ? 'ativada' : 'inativada'} com sucesso!`,
                error: `Erro ao ${acao} a unidade.`,
            }
        ).then(() => {
            carregarUbs();
        });
    };

    const ubsFiltradas = ubsList.filter(u =>
        (u.nome_ubs?.toLowerCase().includes(search.toLowerCase())) ||
        (u.cnes?.includes(search))
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            
            <PremiumHeader 
                icon={Building2}
                title="Unidades de Saúde"
                subtitle="Faça a gestão dos postos de atendimento e infraestrutura local."
                action={
                    <button
                        onClick={() => navigate('/admin/ubs/nova')}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 whitespace-nowrap w-full md:w-auto justify-center"
                    >
                        <Plus size={18} /> Nova Unidade
                    </button>
                }
            />

            {/* Barra de Pesquisa */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                        placeholder="Pesquisar por nome ou CNES..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Listagem */}
            <div className="grid gap-4">
                {loading ? (
                    <LoadingSpinner label="A carregar rede de saúde..." className="py-20" />
                ) : ubsFiltradas.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400 font-bold">
                        Nenhuma unidade de saúde encontrada.
                    </div>
                ) : (
                    ubsFiltradas.map((ubs) => (
                        <div
                            key={ubs.id_ubs}
                            className={`bg-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md border border-slate-100 ${!ubs.sn_ativo ? 'opacity-70 grayscale-[0.5]' : ''}`}
                        >
                            <div className="flex gap-5 items-start">
                                <div className={`p-4 rounded-2xl shadow-inner ${ubs.sn_ativo ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                                    <Building2 size={28} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-black text-slate-800 text-lg">{ubs.nome_ubs}</h3>
                                        <StatusBadge 
                                          label={ubs.sn_ativo ? "Operacional" : "Inativa"} 
                                          type={ubs.sn_ativo ? "success" : "neutral"} 
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-widest">CNES: {ubs.cnes}</p>
                                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                                            <MapPin size={14} className="text-slate-400" />
                                            {ubs.endereco?.logradouro ? `${ubs.endereco.logradouro}${ubs.endereco.bairro ? `, ${ubs.endereco.bairro}` : ''}` : 'Endereço não configurado'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end border-t border-slate-50 md:border-t-0 pt-4 md:pt-0">
                                <button
                                    onClick={() => navigate(`/admin/ubs/editar/${ubs.id_ubs}`)}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all font-bold text-sm"
                                >
                                    <Edit size={16} /> Editar
                                </button>
                                <button
                                    onClick={() => handleToggleStatus(ubs.id_ubs, ubs.sn_ativo)}
                                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-bold text-sm ${ubs.sn_ativo
                                            ? 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100'
                                            : 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                                        }`}
                                >
                                    {ubs.sn_ativo ? (
                                        <><PowerOff size={16} /> Suspender</>
                                    ) : (
                                        <><Power size={16} /> Ativar</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};