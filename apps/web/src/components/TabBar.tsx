import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { effectiveRoutine } from '../lib/history'
import { todayISO } from '../lib/format'
import { t } from '../lib/i18n'
import Icon from './Icon'
import { uiClasses } from '@opengym/ui'

export default function TabBar({ onStart }: any) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home')

  const startWorkout = () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }
  const Tab = ({ k, icon, to, label }) => (
    <button className={`${uiClasses.tab}${on(k) ? ' on' : ''}`} onClick={() => nav(to)}>
      <Icon name={icon} /><span className={uiClasses.tabLabel}>{label}</span>
    </button>
  )

  return (
    <nav id="tabbar" className={uiClasses.tabBar}>
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />
      <button className={`${uiClasses.tabCenter} start${S.active ? ' rec' : ''}`} onClick={startWorkout}>
        <span className={`${uiClasses.tabCircle} cir`}><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
        <span className={uiClasses.tabLabel}>{S.active ? t('Resume') : t('Start')}</span>
      </button>
      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
    </nav>
  )
}
