import { useState, useEffect } from 'react';
import { Plus, Palette, Ban, Globe, Edit2, CheckCircle } from 'lucide-react';
// Importe seu serviço de API ou axios aqui:
// import api from '../../services/api';

interface Municipio {
    id: string;
    nome_exibicao: string;
    slug: string;
    cor_primaria: string;
    faltas_limite: number;
}

export const GerenciarMunicipios = () => {
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [editing, setEditing] = useState<Municipio | null>(null);
    const [loading, setLoading] = useState(true);

    // 1. Resolve o aviso de 'useEffect' e 'municipios'
    useEffect(() => {
        const fetchMunicipios = async () => {
            try {
                // Exemplo de chamada real:
                // const response = await api.get('/municipios');
                // setMunicipios(response.data);

                // Mock para teste inicial:
                setMunicipios([
                    { id: '1', nome_exibicao: 'Belo Horizonte', slug: 'bh-saude', cor_primaria: '#0056b3', faltas_limite: 3 }
                ]);
            } catch (error) {
                console.error("Erro ao carregar municípios", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMunicipios();
    }, []);

    const handleUpdate = (muni: Municipio) => {
        // Aqui você chamaria o seu api.put(`/municipios/${muni.id}`, muni)
        console.log("Salvando:", muni);
        setEditing(null);
    };

    if (loading) return <div className="p-10 text-center">Carregando configurações...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Globe className="text-blue-600" /> Gestão de Tenants (Prefeituras)
                </h1>
                <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={20} /> Nova Prefeitura
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {municipios.map((muni) => (
                    <div key={muni.id} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">{muni.nome_exibicao}</h3>
                                <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">{muni.slug}</p>
                            </div>
                            <div
                                className="w-10 h-10 rounded-lg shadow-inner border-2 border-white"
                                style={{ backgroundColor: muni.cor_primaria }}
                            />
                        </div>

                        <div className="space-y-3 text-sm border-t pt-4">
                            <div className="flex items-center justify-between text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Palette size={16} /> Cor Primária:
                                </div>
                                <span className="font-mono font-medium">{muni.cor_primaria}</span>
                            </div>
                            <div className="flex items-center justify-between text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Ban size={16} /> Limite de Faltas:
                                </div>
                                <span className="font-bold text-red-600">{muni.faltas_limite}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setEditing(muni)} // Corrigido: Agora passa o objeto
                            className="mt-6 w-full flex justify-center items-center gap-2 py-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold transition-colors"
                        >
                            <Edit2 size={16} /> Editar Configurações
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal Simples de Edição (Só aparece se editing não for null) */}
            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Ajustar {editing.nome_exibicao}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Cor Primária</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        className="h-10 w-20 rounded border cursor-pointer"
                                        value={editing.cor_primaria}
                                        onChange={(e) => setEditing({ ...editing, cor_primaria: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        className="flex-1 border rounded px-3"
                                        value={editing.cor_primaria}
                                        onChange={(e) => setEditing({ ...editing, cor_primaria: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Limite de Faltas (Bloqueio)</label>
                                <input
                                    type="number"
                                    className="w-full border rounded px-3 py-2"
                                    value={editing.faltas_limite}
                                    onChange={(e) => setEditing({ ...editing, faltas_limite: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setEditing(null)}
                                    className="flex-1 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleUpdate(editing)}
                                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
                                >
                                    <CheckCircle size={18} /> Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};