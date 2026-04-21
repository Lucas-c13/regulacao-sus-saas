import { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import { Building2, MapPin, CheckCircle, AlertTriangle, Search } from 'lucide-react';

// Shared Components
import { PremiumHeader } from '../../../shared/components/PremiumHeader';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';

interface UBSFormData {
  nome: string;
  cnes: string;
  cep: string;
  endereco: string;
}

interface UBSFormProps {
  dadosIniciais?: Partial<UBSFormData>;
  isEdicao?: boolean;
  buscando: boolean;
  sucessoGlobal?: string | boolean;
  erroGlobal?: string;
  onSubmit: (dados: UBSFormData) => void;
  onCancel?: () => void;
}

export default function UBSForm({
  dadosIniciais,
  isEdicao = false,
  buscando,
  sucessoGlobal,
  erroGlobal,
  onSubmit,
  onCancel
}: UBSFormProps) {

  const [nome, setNome] = useState('');
  const [cnes, setCnes] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');

  const [loadingCep, setLoadingCep] = useState(false);
  const [erroLocal, setErroLocal] = useState('');

  useEffect(() => {
    if (dadosIniciais) {
      setNome(dadosIniciais.nome || '');
      setCnes(dadosIniciais.cnes || '');
      setCep(dadosIniciais.cep || '');
      setEndereco(dadosIniciais.endereco || '');
    }
  }, [dadosIniciais]);

  const buscarCep = async () => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    setErroLocal('');
    
    try {
      const response = await api.get(`/enderecos/cep/${cepLimpo}`);
      const data = response.data;
      
      if (data.erro || !data.logradouro) {
        setErroLocal('CEP não encontrado na base nacional.');
      } else {
        setEndereco(`${data.logradouro}, Bairro ${data.bairro}, ${data.localidade} - ${data.uf}`);
      }
    } catch {
      setErroLocal('Falha de conexão com o buscador de CEP.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErroLocal('');
    onSubmit({
      nome,
      cnes,
      cep: cep.replace(/\D/g, ''),
      endereco
    });
  };

  const erroExibir = erroGlobal || erroLocal;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10 animate-in fade-in duration-500">
      
      <PremiumHeader 
        icon={Building2}
        title={isEdicao ? 'Configurar Unidade' : 'Expansão da Rede'}
        subtitle={isEdicao ? 'Atualize os dados e a infraestrutura do pólo.' : 'Cadastre um novo pólo de atendimento no município.'}
        action={
          onCancel && (
            <button 
              type="button"
              onClick={onCancel}
              className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors"
            >
              ← Regressar
            </button>
          )
        }
      />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        
        {sucessoGlobal && (
           <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-5 rounded-2xl flex items-center space-x-3">
             <CheckCircle className="text-emerald-500 flex-shrink-0" />
             <span className="font-bold">{sucessoGlobal === true ? 'Unidade de saúde inicializada com sucesso!' : sucessoGlobal}</span>
           </div>
        )}

        {erroExibir && (
           <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-5 rounded-2xl flex items-center space-x-3">
             <AlertTriangle className="text-red-500 flex-shrink-0" />
             <span className="font-bold">{erroExibir}</span>
           </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome de Fantasia (Identificação)</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold hover:border-primary/50"
                placeholder="Ex: UBS Centro de Saúde Familiar" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número do CNES</label>
              <input type="text" value={cnes} onChange={e => setCnes(e.target.value)} required maxLength={10}
                disabled={isEdicao}
                className={`w-full px-5 py-4 border border-slate-200 text-slate-800 rounded-2xl outline-none transition-all font-mono font-bold ${isEdicao ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-70' : 'bg-slate-50 focus:ring-4 focus:ring-primary/10 hover:border-primary/50'}`}
                placeholder="Ex: 1234567" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                Motor Autoroute CEP {loadingCep && <Activity size={12} className="animate-spin" />}
              </label>
              <div className="relative group">
                <input type="text" value={cep} 
                  onChange={e => setCep(e.target.value)} 
                  onBlur={buscarCep}
                  required maxLength={9}
                  className="w-full px-5 py-4 bg-emerald-50/50 border border-emerald-200 text-emerald-800 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-black placeholder-emerald-300"
                  placeholder="00000-000" />
                <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300 group-hover:text-emerald-500 transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço Completo</label>
              <div className="relative">
                <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold hover:border-primary/50"
                  placeholder="Rua, Bairro, Cidade - UF" />
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              </div>
            </div>

          </div>

          <div className="pt-8 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={buscando || loadingCep}
              className="bg-primary hover:bg-primary/90 text-white font-black py-4 px-12 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50">
              {buscando ? (
                <LoadingSpinner label="Sincronizando..." size={18} className="p-0 text-white" />
              ) : (isEdicao ? 'Guardar Alterações' : 'Inicializar Nova Unidade')}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
