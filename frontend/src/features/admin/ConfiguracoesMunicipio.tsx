import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import { Settings, Save, Palette, Image as ImageIcon, AlertCircle, ShieldAlert } from 'lucide-react';

// Shared Components
import { PremiumHeader } from '../../shared/components/PremiumHeader';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

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
                const response = await api.get('/municipios/me');
                const dados = response.data;

                setMunicipioId(dados.id_municipio);
                setNomeExibicao(dados.nome_exibicao || dados.nome);
                setCorPrimaria(dados.cor_primaria || '#2563EB');
                setLogoUrl(dados.logo_url || '');
                setFaltasLimite(dados.faltas_limite || 3);
            } catch (error) {
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

            setSucesso('Configurações atualizadas com sucesso! Recarregando sistema...');
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            setErro('Erro ao salvar as configurações.');
        } finally {
            setLoading(false);
        }
    };

    if (userRole !== 'gestor_prefeitura' && userRole !== 'admin_master') {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-slate-500 space-y-4">
                <ShieldAlert size={64} className="text-red-400 opacity-20" />
                <h2 className="text-2xl font-black text-slate-700">Acesso Restrito</h2>
                <p className="font-medium">Apenas gestores do município podem gerenciar a identidade e regras locais.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            
            <PremiumHeader 
                icon={Settings}
                title="Configurações do Município"
                subtitle={`Personalize a identidade visual e regras de negócio de ${nomeExibicao}.`}
            />

            {erro && (
                <div className="bg-red-50 text-red-600 p-5 rounded-2xl flex items-center space-x-3 border border-red-100 font-bold">
                    <AlertCircle size={24} />
                    <span>{erro}</span>
                </div>
            )}

            {sucesso && (
                <div className="bg-emerald-50 text-emerald-700 p-5 rounded-2xl flex items-center space-x-3 border border-emerald-100 font-bold">
                    <Save size={24} />
                    <span>{sucesso}</span>
                </div>
            )}

            <form onSubmit={handleSalvar} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 space-y-10">

                    {/* Identidade Visual */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Palette size={20} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Identidade Visual</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Primária do Sistema</label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="color"
                                        value={corPrimaria}
                                        onChange={(e) => setCorPrimaria(e.target.value)}
                                        className="h-12 w-12 border-0 rounded-xl cursor-pointer shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        value={corPrimaria}
                                        onChange={(e) => setCorPrimaria(e.target.value)}
                                        className="flex-1 border border-slate-200 bg-slate-50 rounded-xl p-3.5 outline-none focus:ring-4 focus:ring-primary/10 font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL da Logomarca (PNG/SVG)</label>
                                <div className="relative group">
                                    <ImageIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="url"
                                        placeholder="https://servidor.com/logo-municipio.png"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Regras de Negócio */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                <ShieldAlert size={20} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Travas de Segurança</h3>
                        </div>

                        <div className="max-w-md space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Limite de Faltas (Absenteísmo)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={faltasLimite}
                                    onChange={(e) => setFaltasLimite(Number(e.target.value))}
                                    className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <span className="bg-primary text-white w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg shadow-lg shadow-primary/20">{faltasLimite}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight ml-1">Número de faltas sem justificativa que bloqueiam o app do cidadão.</p>
                        </div>
                    </section>

                </div>

                <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                    >
                        {loading ? <LoadingSpinner label="Salvando..." size={18} className="p-0 text-white" /> : (
                            <>
                                <Save size={18} />
                                <span>Salvar Configurações</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}