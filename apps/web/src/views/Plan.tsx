import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { DAYN, DAYS, isoOf, uid, exCount } from '../lib/format'
import { t } from '../lib/i18n'
import { cycleCopySheet, cycleDayAssignSheet, dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets'
import { CYCLE_WEEKS, REST_DAY, WEEK_ORDER, copyWeekToCycle, cycleWeekForDate, defaultCycleStart, mondayISO } from '../lib/planning'
import Icon from '../components/Icon'
import { Button, Segmented } from '../components/ui'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs'

function FourWeekSchedule() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const today = isoOf(new Date())
  const cycleStart = S.cycleStart || defaultCycleStart()
  const currentWeek = cycleWeekForDate(today, cycleStart)
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const schedule = S.cyclePlan?.[String(selectedWeek)] || {}
  const explicitCount = WEEK_ORDER.filter(day => schedule[String(day)] !== undefined).length

  const setCycleStart = (value: string) => {
    if (!value) return
    update(s => { s.cycleStart = mondayISO(value) })
  }

  return <div className="cycle-plan">
    <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div><h3 style={{ margin: 0 }}>{t('4-week cycle')}</h3><div className="small muted" style={{ marginTop: 3 }}>{t('Each week has its own plan, then the cycle repeats.')}</div></div>
      <div className="small dim" style={{ whiteSpace: 'nowrap' }}>{t('Current')}: {t('Week')} {currentWeek}</div>
    </div>
    <div className="cycle-plan-tools">
      <label className="cycle-start"><span className="small muted">{t('Cycle starts Monday')}</span><input type="date" value={cycleStart} onChange={event => setCycleStart(event.target.value)} /></label>
      <Button size="sm" variant="tinted" icon="calendar" onClick={() => cycleCopySheet(selectedWeek)}>{t('Copy this week plan')}</Button>
    </div>
    <Segmented
      className="cycle-weeks"
      value={String(selectedWeek)}
      onChange={value => setSelectedWeek(Number(value))}
      options={CYCLE_WEEKS.map(week => ({ value: String(week), label: `${t('Week')} ${week}` }))}
    />
    <div className="small muted cycle-plan-count">{explicitCount ? `${explicitCount} ${t('days planned')} · ` : ''}{t('Edit this week without changing the other three.')}</div>
    <div className="list cycle-days">
      {WEEK_ORDER.map(day => {
        const assignment = schedule[String(day)]
        const cycleRoutine = assignment && assignment !== REST_DAY ? S.routines.find(routine => routine.id === assignment) : null
        const hasCycleAssignment = assignment === REST_DAY || !!cycleRoutine
        const routine = hasCycleAssignment ? cycleRoutine : S.routines.find(item => item.id === S.week?.[day])
        const value = routine ? routine.name : t('Rest')
        return <button type="button" key={day} className={'item cycle-day' + (hasCycleAssignment ? ' cycle-explicit' : ' cycle-fallback')} onClick={() => cycleDayAssignSheet(selectedWeek, day)}>
          <div className="grow"><div className="tt">{t(DAYN[day])}</div><div className="ss">{hasCycleAssignment ? t('This cycle week') : t('Weekly fallback')}</div></div>
          {routine ? <span className="tag acc"><Icon name={glyphOf(routine.emoji)} />{value}</span> : <span className="tag">{value}</span>}
          <Icon name="chevronRight" className="chev" />
        </button>
      })}
    </div>
    <div className="small dim" style={{ textAlign: 'center', marginTop: 10 }}>{t('Week 1 → Week 2 → Week 3 → Week 4, then back to Week 1.')}</div>
  </div>
}

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [view, setView] = useState<'week' | 'cycle'>('cycle')

  const copyWeeklyPlan = () => update(s => {
    s.cyclePlan = copyWeekToCycle(s.week)
    s.cycleStart = s.cycleStart || defaultCycleStart()
  })

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  const routines = <>{S.routines.length ? <div className="list">{S.routines.map(r => <button type="button" key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
    <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
    <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
    <Icon name="chevronRight" className="chev" /></button>)}</div> : <>
    <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
    <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
  </>}</>

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{view === 'cycle' ? t('Your four-week cycle') : t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>
    <Segmented className="seg-range" value={view} onChange={setView} options={[{ value: 'week', label: t('Week'), icon: 'calendar' }, { value: 'cycle', label: t('4-week cycle'), icon: 'calendar' }]} />
    {view === 'cycle' ? <>
      <FourWeekSchedule />
      <div className="cols cycle-plan-lower"><div>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
          <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
        </div>
        {routines}
      </div></div>
    </> : <div className="cols"><div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Week schedule')}</h4>
        <Button size="sm" variant="tinted" icon="calendar" onClick={copyWeeklyPlan}>{t('Copy weekly plan to all weeks')}</Button>
      </div>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {WEEK_ORDER.map(day => {
          const r = S.routines.find(x => x.id === S.week[day])
          return <button type="button" key={day} className="item" onClick={() => dayAssignSheet(day)}>
            <div className="grow"><div className="tt">{t(DAYN[day])}</div></div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            <Icon name="chevronRight" className="chev" /></button>
        })}
      </div>
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
      </div>
      {routines}
    </div></div>}
  </>
}
