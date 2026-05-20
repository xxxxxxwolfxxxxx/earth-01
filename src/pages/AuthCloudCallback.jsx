import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { callOauthCloud } from '../lib/cloudService'

export default function AuthCloudCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing')
  const [error, setError] = useState('')

  useEffect(() => {
    const provider = params.get('provider')
    const code = params.get('code')
    if (!provider || !code) { setStatus('error'); setError('Auth-Parameter fehlen'); return }
    const redirectUri = `${window.location.origin}/auth/cloud-callback?provider=${provider}`
    callOauthCloud({ action: 'exchange', code, redirect_uri: redirectUri })
      .then(() => { setStatus('done'); setTimeout(() => navigate('/data'), 1200) })
      .catch(e => { setStatus('error'); setError(e.message) })
  }, [params, navigate])

  return (
    <div className="max-w-md mx-auto px-4 pt-32 text-center text-white">
      {status === 'processing' && (
        <>
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-nebula-400" />
          <p>Cloud-Verbindung wird hergestellt…</p>
        </>
      )}
      {status === 'done' && (
        <>
          <CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-emerald-400" />
          <p>Verbunden! Weiter zur /data-Seite…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-red-400" />
          <p className="mb-2">Verbindung fehlgeschlagen.</p>
          <p className="text-sm text-gray-400">{error}</p>
        </>
      )}
    </div>
  )
}
