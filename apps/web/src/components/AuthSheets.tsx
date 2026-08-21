import { useEffect, useRef, useState } from 'react'
import { api, emailLogin, emailRegister } from '../lib/api'
import { t } from '../lib/i18n'
import { hasData, useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Button, TextField } from './ui'

export function EmailRegisterSheet({ close }: { close: () => void }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])

  const go = async () => {
    const n = name.trim()
    const address = email.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (!address) { useUI.getState().toast(t('Enter an email address')); return }
    if (password.length < 8) { useUI.getState().toast(t('Password must be at least 8 characters')); return }
    if (password !== confirm) { useUI.getState().toast(t('Passwords do not match')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    setBusy(true)
    try {
      const user = await emailRegister(n, address, password, code.trim())
      setUser(user)
      close()
      if (hasData(useStore.getState().S)) {
        await pushState()
        useUI.getState().toast(t('Profile created — data from this device moved into it'))
      } else {
        await pullState()
        useUI.getState().toast(t('Welcome, {0}', user.name))
      }
    } catch (error) {
      useUI.getState().toast(error.message || t('Registration failed'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <h3>{t('Create an email profile')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Use your email and a password to sign in on any device.')}</div>
    <TextField ref={ref} placeholder={t('Your name')} maxLength={40} value={name} autoComplete="name" onChange={e => setName(e.target.value)} />
    <div style={{ height: 10 }} />
    <input className="input" type="email" placeholder={t('Email address')} value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} />
    <div style={{ height: 10 }} />
    <input className="input" type="password" placeholder={t('Password (8+ characters)')} value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} />
    <div style={{ height: 10 }} />
    <input className="input" type="password" placeholder={t('Repeat password')} value={confirm} autoComplete="new-password" onChange={e => setConfirm(e.target.value)} />
    {inviteOnly && <>
      <div style={{ height: 10 }} />
      <input className="input" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
      <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
    </>}
    <div style={{ height: 12 }} />
    <Button variant="primary" disabled={busy} onClick={go}>{busy ? t('Creating…') : t('Create email profile')}</Button>
  </>
}

export function EmailLoginSheet({ close }: { close: () => void }) {
  const { setUser, pullState } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    if (!email.trim() || !password) { useUI.getState().toast(t('Enter your email and password')); return }
    setBusy(true)
    try {
      const user = await emailLogin(email.trim(), password)
      setUser(user)
      close()
      await pullState()
      useUI.getState().toast(t('Welcome back, {0}', user.name))
    } catch (error) {
      useUI.getState().toast(error.message || t('Sign-in failed'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <h3>{t('Sign in with email')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Use the email and password for your openGym profile.')}</div>
    <input className="input" type="email" placeholder={t('Email address')} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
    <div style={{ height: 10 }} />
    <input className="input" type="password" placeholder={t('Password')} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
    <div style={{ height: 12 }} />
    <Button variant="primary" disabled={busy} onClick={go}>{busy ? t('Signing in…') : t('Sign in')}</Button>
  </>
}
