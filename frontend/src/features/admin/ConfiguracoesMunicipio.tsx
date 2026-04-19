import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import { Settings, Save, Palette, Image as ImageIcon, AlertCircle, ShieldAlert } from 'lucide-react';

export default function ConfiguracoesMunicipio() {
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sucesso, setSucesso] = useState('');
    const [erro, setErro] = useState('');

    // Estados do formulário
    const [corPrimaria, setCorPrimaria] = useState('#2563EB');
    const [logoUrl, setLogoUrl] = useState('');
    const [faltasLimite, setFaltasLimite] = useState(3);
    const [municipioId, setMunicipioId] = useState('');
    const [nomeExibicao, setNomeExibicao] = useState('');

    useEffect(() => {
        const carregarConfiguracoes = async () => {
            try {
                setLoading(true);
                // Ajuste a rota para o seu endpoint que retorna os dados do Tenant atual logado
                const response = await api.get('/municipios/me');
                const dados = response.data;

                setMunicipioId(dados.id_municipio);
                setNomeExibicao(dados.nome_exibicao || dados.nome);
                setCorPrimaria(dados.cor_primaria || '#2563EB');
                setLogoUrl(dados.logo_url || '');
                setFaltasLimite(dados.faltas_limite || 3);
            } catch (error) {
                console.error('Erro ao carregar configurações:', error);
                setErro('Não foi possível carregar as configurações do município.');
            } finally {
                setLoading(false);
            }
        };

        carregarConfiguracoes();
    }, []);

    const handleSalvar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setErro('');
            setSucesso('');

            await api.put(`/municipios/${municipioId}`, {
                cor_primaria: corPrimaria,
                logo_url: logoUrl,
                faltas_limite: faltasLimite
            });

            setSucesso('Configurações atualizadas com sucesso! As cores podem levar alguns segundos para aplicar.');

            // Dica UX: Recarrega a página após 2s para o CSS injetar a nova cor
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Erro ao atualizar:', error);
            setErro('Erro ao salvar as configurações.');
        } finally {
            setLoading(false);
        }
    };

    if (userRole !== 'gestor_prefeitura' && userRole !== 'admin_master') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                <ShieldAlert size={48} className="text-red-400" />
                <h2 className="text-xl font-semibold">Acesso Restrito</h2>
                <p>Apenas gestores do município podem alterar estas configurações.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-3 mb-8">
                <Settings className="w-8 h-8 text-primary" />
                <div>
                    <h2 className="text-2xl font-bold text-textMain">Configurações do Município</h2>
                    <p className="text-sm text-gray-500">Personalize a identidade visual e regras de {nomeExibicao}.</p>
                </div>
            </div>

            {erro && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center space-x-2 border border-red-200">
                    <AlertCircle size={20} />
                    <span>{erro}</span>
                </div>
            )}

            {sucesso && (
                <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center space-x-2 border border-green-200">
                    <Save size={20} />
                    <span>{sucesso}</span>
                </div>
            )}

            <form onSubmit={handleSalvar} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-8">

                    {/* Sessão: Identidade Visual */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
                            <Palette size={20} className="text-primary" />
                            Identidade Visual
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cor Primária (HEX)</label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="color"
                                        value={corPrimaria}
                                        onChange={(e) => setCorPrimaria(e.target.value)}
                                        className="h-10 w-10 border-0 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={corPrimaria}
                                        onChange={(e) => setCorPrimaria(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Essa cor será aplicada nos botões e menus do sistema.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">URL da Logomarca</label>
                                <div className="flex items-center relative">
                                    <ImageIcon size={18} className="absolute left-3 text-gray-400" />
                                    <input
                                        type="url"
                                        placeholder="https://exemplo.com/logo.png"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Insira o link direto para a imagem (PNG transparente recomendado).</p>
                            </div>
                        </div>
                    </section>

                    {/* Sessão: Regras de Negócio */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
                            <ShieldAlert size={20} className="text-primary" />
                            Regras e Travas
                        </h3>

                        <div className="w-full md:w-1/2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Limite de Faltas (Absenteísmo)</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={faltasLimite}
                                onChange={(e) => setFaltasLimite(Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-gray-500 mt-1">Número máximo de faltas antes do paciente ser bloqueado no agendamento automático.</p>
                        </div>
                    </section>

                </div>

                <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-70"
                    >
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form>
        </div>
    );
}