import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { Building2, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

export default function CadastroUBS() {
  const { userPayload } = useAuth();
  
  const [nome, setNome] = useState('');
  const [cnes, setCnes] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  
  const [loadingCep, setLoadingCep] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // O "Motor" ViaCEP
  const buscarCep = async (valor: string) => {
    const cepLimpo = valor.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    setErro('');
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        setErro('CEP Mágico falhou: Endereço não encontrado no Correios.');
      } else {
        setEndereco(`${data.logradouro}, Bairro ${data.bairro}, ${data.localidade} - ${data.uf}`);
      }
    } catch {
      setErro('Falha de conexão com o ViaCEP.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);
    setBuscando(true);

    try {
      // POST protegido JWT para criar a UBS
      await api.post('/ubs', {
        id_municipio: userPayload?.id_municipio,
        nome: nome,
        cnes: cnes,
        cep: cep.replace(/\D/g, ''),
        endereco: endereco
      });

      setSucesso(true);
      setNome(''); setCnes(''); setCep(''); setEndereco('');
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro crítico ao registar Unidade de Saúde.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <Building2 size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Expansão da Rede (Nova UBS)</h2>
          <p className="text-slate-500 font-medium">Cadastre um novo pólo de Saúde da Família usando Injeção Nacional de CEPs</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        
        {sucesso && (
           <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl flex items-center space-x-3">
             <CheckCircle className="text-emerald-500" />
             <span className="font-semibold">Infraestrutura montada! A NOVA Unidade de Saúde já está aceitando logins sob a tutela deste Município!</span>
           </div>
        )}

        {erro && (
           <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
             <AlertTriangle className="text-red-500" />
             <span className="font-semibold">{erro}</span>
           </div>
        )}

        <form onSubmit={handleCadastrar} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome de Fantasia Oficial da UBS</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
                placeholder="Ex: UBS Centro de Saúde Familiar" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Registro CNES</label>
              <input type="text" value={cnes} onChange={e => setCnes(e.target.value)} required maxLength={7}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
                placeholder="Ex: 1234567" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-emerald-600 uppercase tracking-wide inline-flex items-center gap-1">
                Motor Autoroute CEP {loadingCep && <span className="text-xs animate-pulse font-normal">(a calcular rua...)</span>}
              </label>
              <input type="text" value={cep} 
                onChange={e => setCep(e.target.value)} 
                onBlur={e => buscarCep(e.target.value)}
                required maxLength={9}
                className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-black placeholder-emerald-300"
                placeholder="12345-678 (Tire o Fócus)" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Localização Detalhada</label>
              <div className="relative">
                <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
                  placeholder="Rua Ficticia, Bairro Central" />
                <MapPin className="absolute left-3 top-3.5 text-slate-400" size={18} />
              </div>
            </div>

          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={buscando || loadingCep}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-primary/30 transition-all active:scale-95 disabled:opacity-50">
              {buscando ? 'A INJETAR NO DATABASE...' : 'INICIALIZAR NOVA UBS NA REDE'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
