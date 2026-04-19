import { useState, useEffect } from 'react';
import { api } from '../../core/api'; // Ajuste o caminho conforme sua estrutura
import { CalendarX, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Feriado {
    id_feriado: string;
    data: string;
    descricao: string;
    tipo: 'nacional' | 'estadual' | 'municipal' | 'ponto_facultativo';
}

export default function GestaoFeriados() {
    const [feriados, setFeriados] = useState<Feriado[]>([]);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Estados do formulário
    const [novaData, setNovaData] = useState('');
    const [novaDescricao, setNovaDescricao] = useState('');
    const [novoTipo, setNovoTipo] = useState<Feriado['tipo']>('municipal');

    const carregarFeriados = async () => {
        try {
            setLoading(true);
            // Ajuste a rota para a que você definiu no seu feriados.py
            const response = await api.get('/feriados/');
            setFeriados(response.data);
        } catch (error) {
            console.error('Erro ao buscar feriados:', error);
            setErro('Não foi possível carregar a lista de feriados.');
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
            setLoading(true);
            await api.post('/feriados/', {
                data: novaData,
                descricao: novaDescricao,
                tipo: novoTipo
            });

            setNovaData('');
            setNovaDescricao('');
            carregarFeriados(); // Recarrega a lista
        } catch (error) {
            console.error('Erro ao criar feriado:', error);
            setErro('Erro ao adicionar o feriado. Verifique os dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemover = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja remover este bloqueio da agenda?')) return;

        try {
            setLoading(true);
            await api.delete(`/feriados/${id}`);
            carregarFeriados();
        } catch (error) {
            console.error('Erro ao remover feriado:', error);
            setErro('Erro ao remover o feriado.');
        } finally {
            setLoading(false);
        }
    };

    // Função para formatar data (YYYY-MM-DD para DD/MM/YYYY)
    const formatarData = (dataIso: string) => {
        const [ano, mes, dia] = dataIso.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <CalendarX className="w-8 h-8 text-primary" />
                <div>
                    <h2 className="text-2xl font-bold text-textMain">Gestão de Feriados</h2>
                    <p className="text-sm text-gray-500">Bloqueie datas para evitar agendamentos automáticos.</p>
                </div>
            </div>

            {erro && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center space-x-2">
                    <AlertCircle size={20} />
                    <span>{erro}</span>
                </div>
            )}

            {/* Formulário de Adição */}
            <form onSubmit={handleAdicionar} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                    <input
                        type="date"
                        required
                        value={novaData}
                        onChange={(e) => setNovaData(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <input
                        type="text"
                        required
                        placeholder="Ex: Aniversário da Cidade"
                        value={novaDescricao}
                        onChange={(e) => setNovaDescricao(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                        value={novoTipo}
                        onChange={(e) => setNovoTipo(e.target.value as Feriado['tipo'])}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                    >
                        <option value="municipal">Municipal</option>
                        <option value="estadual">Estadual</option>
                        <option value="nacional">Nacional</option>
                        <option value="ponto_facultativo">Ponto Facultativo</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-70"
                >
                    <Plus size={20} />
                    Adicionar
                </button>
            </form>

            {/* Tabela de Feriados */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="p-4 font-semibold text-gray-600">Data</th>
                            <th className="p-4 font-semibold text-gray-600">Descrição</th>
                            <th className="p-4 font-semibold text-gray-600">Tipo</th>
                            <th className="p-4 font-semibold text-gray-600 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {feriados.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-500">
                                    Nenhum feriado cadastrado. A agenda está totalmente livre.
                                </td>
                            </tr>
                        ) : (
                            feriados.map((feriado) => (
                                <tr key={feriado.id_feriado} className="border-b border-gray-100 hover:bg-gray-50/50">
                                    <td className="p-4 font-medium text-textMain">{formatarData(feriado.data)}</td>
                                    <td className="p-4 text-gray-700">{feriado.descricao}</td>
                                    <td className="p-4 text-gray-700 capitalize">{feriado.tipo.replace('_', ' ')}</td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleRemover(feriado.id_feriado)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remover Feriado"
                                        >
                                            <Trash2 size={18} />
                                        </button>
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