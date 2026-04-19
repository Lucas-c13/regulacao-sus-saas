import { useState, useEffect } from 'react';
import { Search, Building2, Plus, Power, PowerOff, Edit, RefreshCcw, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api } from '../../core/api'; // A nossa instância do Axios

interface UBS {
    id_ubs: string;
    nm_ubs: string;
    cnes: string;
    sn_ativo: boolean;
    endereco?: {
        logradouro?: string;
        bairro?: string;
    };
}

export const ListaUBS = () => {
    const [ubsList, setUbsList] = useState<UBS[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    const carregarUbs = async () => {
        setLoading(true);
        try {
            // Chamada ao backend para listar todas as UBS do Município logado
            const res = await api.get('/ubs/');
            setUbsList(res.data);
        } catch (error) {
            toast.error("Erro ao carregar a lista de unidades de saúde.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarUbs();
    }, []);

    // Função para Ativar/Inativar a UBS
    const handleToggleStatus = async (id_ubs: string, statusAtual: boolean) => {
        const novoStatus = !statusAtual;
        const acao = novoStatus ? 'ativar' : 'inativar';

        toast.promise(
            // Assumindo que o seu endpoint aceita um PATCH para atualizar dados parciais
            api.patch(`/ubs/${id_ubs}`, { sn_ativo: novoStatus }),
            {
                loading: `A ${acao} unidade...`,
                success: `Unidade ${novoStatus ? 'ativada' : 'inativada'} com sucesso!`,
                error: `Erro ao ${acao} a unidade.`,
            }
        ).then(() => {
            carregarUbs(); // Recarrega a lista para atualizar a cor do card
        });
    };

    const ubsFiltradas = ubsList.filter(u =>
        (u.nm_ubs?.toLowerCase().includes(search.toLowerCase())) ||
        (u.cnes?.includes(search))
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500">
            <RefreshCcw className="animate-spin mb-2 text-primary" size={32} />
            A carregar unidades de saúde...
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Building2 size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Unidades de Saúde</h1>
                        <p className="text-slate-500 font-medium">Faça a gestão dos postos de atendimento do município</p>
                    </div>
                </div>

                <div className="flex w-full md:w-auto gap-3">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all bg-slate-50"
                            placeholder="Pesquisar por nome ou CNES..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {/* Encaminha para o ecrã de CadastroUBS que já tínhamos criado */}
                    <button
                        onClick={() => navigate('/admin/ubs/nova')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={18} /> Nova UBS
                    </button>
                </div>
            </div>

            {/* Listagem em Cards */}
            <div className="grid gap-4">
                {ubsFiltradas.map((ubs) => (
                    <div
                        key={ubs.id_ubs}
                        className={`bg-white p-5 rounded-2xl border-l-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md ${ubs.sn_ativo ? 'border-primary' : 'border-slate-300 opacity-75'}`}
                    >
                        <div className="flex gap-4 items-start sm:items-center">
                            <div className={`p-4 rounded-xl shadow-inner mt-1 sm:mt-0 ${ubs.sn_ativo ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                                <Building2 size={26} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-slate-800 text-lg">{ubs.nm_ubs}</h3>
                                    {!ubs.sn_ativo && (
                                        <span className="text-[10px] uppercase font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">Inativa</span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500 mt-1 space-y-1">
                                    <p className="font-mono text-xs text-slate-400">CNES: {ubs.cnes || 'Não informado'}</p>
                                    <p className="flex items-center gap-1.5">
                                        <MapPin size={14} className="text-slate-400" />
                                        {ubs.endereco?.logradouro ? `${ubs.endereco.logradouro}${ubs.endereco.bairro ? `, ${ubs.endereco.bairro}` : ''}` : 'Sem morada registada'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                            <button
                                onClick={() => navigate(`/admin/ubs/editar/${ubs.id_ubs}`)}
                                className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors active:scale-95 font-medium text-sm"
                            >
                                <Edit size={16} /> Editar
                            </button>
                            <button
                                onClick={() => handleToggleStatus(ubs.id_ubs, ubs.sn_ativo)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors active:scale-95 font-medium text-sm ${ubs.sn_ativo
                                        ? 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100'
                                        : 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                                    }`}
                            >
                                {ubs.sn_ativo ? (
                                    <><PowerOff size={16} /> Inativar</>
                                ) : (
                                    <><Power size={16} /> Ativar</>
                                )}
                            </button>
                        </div>
                    </div>
                ))}

                {ubsFiltradas.length === 0 && !loading && (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 font-medium">
                        Nenhuma unidade de saúde encontrada.
                    </div>
                )}
            </div>
        </div>
    );
};