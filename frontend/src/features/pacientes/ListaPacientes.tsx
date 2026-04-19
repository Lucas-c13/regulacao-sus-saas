import { useState, useEffect } from 'react';
import { Search, UserX, UserCheck, Key, RefreshCcw, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../core/api'; // Importando nossa instância real do Axios

interface Paciente {
    id_paciente: string; // Atualizado para bater com o BD
    nm_paciente: string;
    nr_cpf: string;
    faltas_acumuladas?: number; // Opcional por enquanto até o backend mandar
    bloqueado?: boolean;
}

export const ListaPacientes = () => {
    const [pacientes, setPacientes] = useState<Paciente[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const carregarPacientes = async () => {
        setLoading(true);
        try {
            // Chamada real ao backend (vai trazer os pacientes do tenant logado)
            const res = await api.get('/pacientes/');

            // Mapeando a resposta para garantir as flags visuais (mesmo que o backend ainda não envie as faltas agregadas no GET)
            const dadosReais = res.data.map((p: any) => ({
                ...p,
                // Simulando o bloqueio visual caso o backend ainda não traga esses campos no schema GET padrão
                faltas_acumuladas: p.faltas_acumuladas || 0,
                bloqueado: p.faltas_acumuladas >= 3 || false
            }));

            setPacientes(dadosReais);
        } catch (error) {
            toast.error("Erro ao carregar lista de pacientes");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarPacientes();
    }, []);

    // Chamada REAL para perdoar as faltas
    const handleJustificar = async (id_paciente: string) => {
        toast.promise(
            api.patch(`/pacientes/${id_paciente}/desbloquear`),
            {
                loading: 'Processando desbloqueio...',
                success: 'Utente desbloqueado com sucesso!',
                error: (err) => err.response?.data?.detail || 'Erro ao justificar faltas.',
            }
        ).then(() => {
            // Recarrega a lista para atualizar o layout visual (ficar verdinho)
            carregarPacientes();
        });
    };

    // Chamada REAL para gerar nova senha provisória
    const handleResetSenha = async (id_paciente: string) => {
        toast.promise(
            api.put(`/pacientes/${id_paciente}`, { nova_senha: 'Mudar@123' }),
            {
                loading: 'Gerando senha provisória...',
                success: 'Senha reposta para "Mudar@123"! Utente será forçado a trocar.',
                error: 'Erro ao repor a senha.',
            }
        );
    };

    const pacientesFiltrados = pacientes.filter(p =>
        (p.nm_paciente?.toLowerCase().includes(search.toLowerCase())) ||
        (p.nr_cpf?.includes(search))
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-gray-500">
            <RefreshCcw className="animate-spin mb-2 text-blue-600" size={32} />
            A carregar utentes...
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gestão de Cidadãos</h1>
                    <p className="text-gray-500 font-medium">Controle de absenteísmo e acessos</p>
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50"
                        placeholder="Buscar por nome ou CPF..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {pacientesFiltrados.map((p) => (
                    <div
                        key={p.id_paciente}
                        className={`bg-white p-5 rounded-2xl border-l-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md ${p.bloqueado ? 'border-red-500' : 'border-emerald-500'}`}
                    >
                        <div className="flex gap-4 items-center">
                            <div className={`p-4 rounded-full shadow-inner ${p.bloqueado ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {p.bloqueado ? <UserX size={26} /> : <UserCheck size={26} />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">{p.nm_paciente}</h3>
                                <p className="text-sm text-gray-500 font-mono tracking-wide">CPF: {p.nr_cpf || 'Não informado'}</p>
                            </div>
                        </div>

                        <div className="flex gap-6 sm:gap-10 items-center justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                            <div className="text-center bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                <span className={`block text-2xl font-black ${p.faltas_acumuladas && p.faltas_acumuladas >= 3 ? 'text-red-600' : 'text-slate-700'}`}>
                                    {p.faltas_acumuladas || 0}
                                </span>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Faltas</span>
                            </div>

                            <div className="flex gap-2">
                                {p.bloqueado && (
                                    <button
                                        onClick={() => handleJustificar(p.id_paciente)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 text-sm font-bold active:scale-95"
                                    >
                                        <ShieldCheck size={18} /> Justificar
                                    </button>
                                )}
                                <button
                                    onClick={() => handleResetSenha(p.id_paciente)}
                                    className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors active:scale-95"
                                    title="Gerar senha provisória"
                                >
                                    <Key size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {pacientesFiltrados.length === 0 && !loading && (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 font-medium">
                        Nenhum paciente encontrado com a sua pesquisa.
                    </div>
                )}
            </div>
        </div>
    );
};