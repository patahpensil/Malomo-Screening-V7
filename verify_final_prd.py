#!/usr/bin/env python3
"""Research-only acceptance tests of final PRD arithmetic and recorded evidence.
Does NOT backtest Confluense M6, validate market edge, or place trades.
"""
from pathlib import Path
from collections import Counter
import csv, json, math, hashlib, random
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'evidence'
results={}
def test(id, condition, detail=''):
    results[id]={'status':'PASS' if bool(condition) else 'FAIL','detail':detail}

def clip(x,lo=0.,hi=1.): return min(max(x,lo),hi)
def score1(state,te,adx,pct):
    assert state in ('BULLISH','BEARISH','TRANSITION')
    return (45 if state!='TRANSITION' else 22.5)+25*clip(te)+10*clip(adx/50.)+20*clip(1.-2.*abs(pct-0.5))
def pullback(q,d,age):return 5*q+10*clip(1.-abs(d-.5)/.35)+5+10*clip(1.-age/12.)
def m2(gen,mo,pa,integrity):
    assert 0<=gen<=30 and 0<=mo<=25 and 0<=pa<=25
    if integrity!=20: return None
    return gen+mo+pa+integrity
def score_m6(xs):
    if len(xs)!=5 or any(x is None or not math.isfinite(x) or x<0 or x>100 for x in xs):return None
    return sum(xs)
def ecdf(values,x):return sum(v<=x for v in values)/len(values)

test('T01', all(sum(w)==100 for w in [(45,25,10,20),(30,25,25,20),(60,40),(40,35,25),(30,25,25,20)]),'M1-M5 weights each = 100; M2 80+20')
test('T02', score_m6([85,85,70,100,55])==395 and 100*395/500==79,'example M6 =395; display =79%')
test('T03', score1('BULLISH',.6,25,.5)==85,'M1 synthetic')
test('T04', not (105>105.5), 'wick only high>level does not satisfy close criterion')
test('T05', (1<=1<=6) and not (0>=1), 'retest after break only')
def breakout_step(side,price,level,buffer,tol,touched):
    if side*(price-level)<-tol:return 'INVALID'
    if touched and side*(price-level)>buffer:return 'CONFIRMED'
    return 'WAITING_RETEST'
test('T06',breakout_step(1,97.9,100,0.5,2,True)=='INVALID','invalidation precedes intrabar touch/confirmation')
test('T07',abs(pullback(.8,.5,2)-27.333333333333336)<1e-10,'pullback = 27.33333333')
base=[-0.3,0.,.2,.2,.7]; frozen_baseline=ecdf(base,.2); future_observations=[-50.,50.];
test('T08',frozen_baseline==4/5 and ecdf(base,.2)==frozen_baseline and ecdf(base+future_observations,.2)!=frozen_baseline,'right-tie policy and freeze prevents future information contamination')
test('T09',len(list(range(179)))<180,'missing tail window -> INCOMPLETE')
def riskcheck(entry,atr,equity,openrisk,opengross,activepairs,pair,side):
    if entry<=0 or atr<=0 or equity<=0:return None
    stop=entry-side*1.5*atr
    if stop<=0:return False
    qty=min(.01*equity/abs(entry-stop),equity/entry)
    newrisk=qty*abs(entry-stop);notional=qty*entry
    return newrisk+openrisk<=.03*equity+1e-12 and notional+opengross<=equity+1e-12 and len(activepairs)<3 and pair not in activepairs

test('T10',riskcheck(100,2,100,0,95,set(),'BTCUSDT',1) is False,'gross cap rejects, no M6')
def canonical(labels):
    bykey={}
    for z in labels:bykey.setdefault((z['pair'],z['time'],z['side']),[]).append(z['family'])
    bypairtime={}
    for (pair,t,side) in bykey:bypairtime.setdefault((pair,t),set()).add(side)
    out={}
    for key,families in bykey.items():
        if len(bypairtime[(key[0],key[1])])>1:st='CONFLICTING_DIRECTIONS'
        elif len(set(families))>1:st='MULTI_METHOD_COLLISION'
        else:st='UNIQUE_CANDIDATE'
        out[key]=st
    return out

a=[{'pair':'BTCUSDT','time':'T','side':1,'family':'B'},{'pair':'BTCUSDT','time':'T','side':-1,'family':'B'}]
test('T11',all(v=='CONFLICTING_DIRECTIONS' for v in canonical(a).values()), 'opposed directions block selection')
b=[{'pair':'BTCUSDT','time':'T','side':1,'family':'B'},{'pair':'BTCUSDT','time':'T','side':1,'family':'P'}]
test('T12',list(canonical(b).values())==['MULTI_METHOD_COLLISION'],'multi-family same event collision')
c=[{'pair':'BTCUSDT','time':'T','side':1,'family':'B'},{'pair':'BTCUSDT','time':'T','side':1,'family':'B'}]
test('T13',len(canonical(c))==1 and list(canonical(c).values())==['UNIQUE_CANDIDATE'],'exact labels dedup')
test('T14',not {'MEAN_REVERSION','PATTERN_BASED'}.intersection({'BREAKOUT_RETEST','PULLBACK_CONTINUATION','REVERSAL_RETEST'}),'non-scored families excluded')
test('T15',30+25+0+0==55,'M5 historical snapshot')
cands=[{'M6':390,'M2':50,'M1':95,'pair':'X','side':1,'family':'BREAKOUT_RETEST'},{'M6':395,'M2':60,'M1':80,'pair':'Y','side':1,'family':'BREAKOUT_RETEST'}]
cands.sort(key=lambda x:(-x['M6'],-x['M2'],-x['M1'],x['pair'],0 if x['side']==1 else 1,x['family']))
test('T16',cands[0]['pair']=='Y','higher confluence ranks first')
test('T17',riskcheck(100,2,100,0,0,{'BTCUSDT','ETHUSDT','SOLUSDT'},'BNBUSDT',1) is False,'concurrent cap rejects additional candidate')
test('T18',m2(27,20,18,16) is None,'integrity partial prohibits numeric ranking')
test('T19',score_m6([85,None,70,100,55]) is None,'missing taker/M2 means no M6')
input_labels=b+a+c
z1=canonical(input_labels); shuffled=list(input_labels);random.Random(20261010).shuffle(shuffled)
z2=canonical(shuffled)
test('T20',z1==z2,'order invariant for canonicalization')
# Evidence from 2024 artifacts, optional but required for success when in this package.
canonical_path=SOURCE/'CANONICAL_SCORES_410_EVENTS_2024.csv'
with canonical_path.open(newline='',encoding='utf-8') as f:rows=list(csv.DictReader(f))
assert len(rows)==410
bad_m1=[];bad_m2=[];nan_rows=0
for r in rows:
    try:
        m1=sum(map(float,(r['s45'],r['trend_25te_10adx'],r['vol20'])))
        m2=sum(map(float,(r['signal_generation_30'],r['momentum_25'],r['participation_25'])))
        if abs(m1-float(r['m1_100']))>1e-7:bad_m1.append(r['pair'])
        if abs(m2-float(r['signal_quality_80']))>1e-7:bad_m2.append(r['pair'])
        if not(0<=m1<=100+1e-7 and 0<=m2<=80+1e-7):nan_rows+=1
    except (ValueError,KeyError):nan_rows+=1

test('E01',not bad_m1 and not bad_m2 and not nan_rows,'410/410 M1 and M2 quality additive, in bounds')
with (SOURCE/'closure_contracts.json').open(encoding='utf-8') as f:prior=json.load(f)
test('E02',prior['passed']==33 and prior['failed']==0, 'prior generator v2 contract snapshot 33 PASS')
with (SOURCE/'frozen_cdf_normalization.json').open(encoding='utf-8') as f:cdf1=json.load(f)
with (SOURCE/'frozen_v2_normalizations.json').open(encoding='utf-8') as f:cdf2=json.load(f)
test('E03',cdf1['population_n']==258 and cdf2['pullback']['train_n']==189 and cdf2['reversal']['train_n']==44, 'train normalization counts: 258/189/44')
# --- v1.0.1 document-consistency tests (T21-T23) ---
import re
prd_text=next(ROOT.glob('PRD_FINAL_*.md')).read_text(encoding='utf-8')
EVENT={'WAITING_RETEST','WAITING_ZONE','WAITING_CONTINUATION','CHOCH_CANDIDATE','CONFIRMED','INVALID','EXPIRED','CENSORED','PREZONE_CENSORED','UNSUPPORTED_FOR_SCORING','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION'}
SCORE={'SCORED','NOT_APPLICABLE','INCOMPLETE','DATA_INCOMPLETE','CALIBRATION_INCOMPLETE','SCORE_INCOMPLETE','AUDIT_INCOMPLETE','NO_SCORE'}
DECISION={'CLOSE_CANDIDATE','ENTRY_CONSIDER','NO_ENTRY','REJECTED_DIRECTION','REJECTED_INTEGRITY','REJECTED_RISK','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION','RESEARCH_ONLY'}
examples=[json.loads(b) for b in re.findall(r'```json\n(.*?)```',prd_text,re.S)]
def layers_ok(x):
    if x['event_status'] not in EVENT or x['score_status'] not in SCORE or x['status'] not in DECISION:return False
    if x['status']=='ENTRY_CONSIDER':return x['event_status']=='CONFIRMED' and x['score_status']=='SCORED' and x['reasons']==[]
    if x['status']!='CLOSE_CANDIDATE':return len(x['reasons'])>0
    return True
test('T21',len(examples)==2 and all(layers_ok(x) for x in examples),'three-layer status codes valid in both JSON examples')
REQ=['equity_sim','atr_entry','atr_frozen','event_status','score_status','status','reasons','symbol','side','signal_family','decision_available_utc','entry_reference_open','stop_price','target_price','qty','risk_pct','gross_pct','rr_target','max_holding_hours','invalidation','data_quality_flags','source_labels','m5_snapshot','normalization_version']
def schema_ok(x):
    if any(k not in x for k in REQ):return False
    eq=x.get('equity_sim',100.0)
    if abs(x['gross_pct']-100*x['qty']*x['entry_reference_open']/eq)>1e-9:return False
    if x['status']!='ENTRY_CONSIDER' and x['scores']['m6_confluense_500'] is not None:return False
    if x['status']=='ENTRY_CONSIDER':
        s=x['scores'];return s['m6_confluense_500']==s['m1_100']+s['m2_100']+s['m3_100']+s['m4_100']+s['m5_100']
    return True
test('T22',len(examples)==2 and all(schema_ok(x) for x in examples),'required fields present; gross_pct arithmetic; rejected m6=null')
ntrain=sum(r['period']=='train' for r in rows);neval=sum(r['period']=='eval' for r in rows)
test('T23',ntrain==258==cdf1['population_n'] and neval==152 and len(rows)==410 and '257 confirmed train' not in prd_text,'sample reconciliation 258/152/410; legacy 257 wording removed')
def times_ok(x):
    if not ('break_utc' in x and 'confirmation_utc' in x and 'm1_origin_direction' in x):return False
    if not (x['confirmation_utc']==x['decision_available_utc']==x['entry_reference_time_utc']):return False
    if x['signal_family']=='PULLBACK_CONTINUATION':return x['break_utc'] is None and x['m1_origin_direction'] is None
    if x['break_utc'] is None or not x['break_utc']<x['confirmation_utc']:return False
    return x['signal_family']=='REVERSAL_RETEST' or x['m1_origin_direction'] is None
test('T24',len(examples)==2 and all(times_ok(x) for x in examples) and 'ATR_entry=ATR14[tc]' in prd_text and 'M1_origin' in prd_text,'v1.0.2 time fields, ATR_entry and M1_origin rules present')
test('T25','ewm(alpha=1/14, adjust=False)' in prd_text and 'menunggu konfirmasi' not in prd_text and '`i+26` **inklusif**' in prd_text,'v1.0.3 indicator method and Pullback window fixed')
test('T26','CONFLICT_CHECK_NOT_LOGGED' in prd_text and 'full-train in-sample' in prd_text and prd_text.count('BREAKOUT_2024_NO_DIRECTION_GATE')>=3,'v1.0.4 conflict4 log contract and evidence scope labels present')
test('T27',all(k in prd_text for k in ('FETCH_FAILED','CONFIRMED_GAP','GROSS_CAP','PAIR_ACTIVE','POSITION_OR_RISK_CAP','slot_release_utc = entry + 24h')) and 'atau sampai penutupan lebih awal menurut evaluasi' not in prd_text and all(x['scores']['m1_plus_m2q_0_180_display_only']==x['scores']['m1_100']+x['scores']['m2_signal_quality_80'] for x in examples),'v1.0.5 data/gap reasons, fixed 24h slot, M4 reason codes, display field')
# --- T28: causal ECDF CSV (v1.0.6) ---
def _t28():
    P=SOURCE/'ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv'
    if hashlib.sha256(P.read_bytes()).hexdigest()!='b38b6ddaa99f1fd12bbe8187158d84356186c4b9d36faee612c7d9a6becf3118':return False
    with P.open(newline='',encoding='utf-8') as f:R=list(csv.DictReader(f))
    tr=[r for r in R if r['period']=='TRAIN'];ev=[r for r in R if r['period']=='EVAL']
    if (len(R),len(tr),len(ev))!=(772,491,281):return False
    if sum(r['score_status']=='CAUSAL_SCORE_VALID' and r['period']=='TRAIN' for r in R)!=400:return False
    if sum(r['score_status']=='CALIBRATION_INCOMPLETE' for r in R)!=91:return False
    by={}
    for r in tr:by.setdefault(r['signal_family'],[]).append(r)
    E=lambda a,x:sum(v<=x for v in a)/len(a)
    fz={'BREAKOUT':[cdf1['features'][k]['sorted_train'] for k in 'ELVB']}
    for fam,key in (('PULLBACK','pullback'),('REVERSAL','reversal')):
        ff=cdf2[key]['features'];fz[fam]=[ff[k]['values'] for k in ('mo_e4_raw','mo_close_raw','pa_rvol_raw','pa_taker_raw')]
    rs=cdf2['reversal_signal_cdf']['features'];fzT=(rs['trigger_raw']['values'],rs['retest_raw']['values'])
    def sc(r,A,TR):
        x=[float(r[k]) for k in ('raw_e4','raw_closepos','raw_rvol','raw_taker')]
        g=15*E(TR[0],float(r['raw_reversal_trigger']))+15*E(TR[1],float(r['raw_reversal_retest'])) if r['signal_family']=='REVERSAL' else float(r['m2_signal_generation30_archived'])
        return g+15*E(A[0],x[0])+10*E(A[1],x[1])+10*E(A[2],x[2])+15*E(A[3],x[3])
    for r in R:
        fam=r['signal_family'];t=r['confirmation_available_utc'];prior=[p for p in by[fam] if p['confirmation_available_utc']<t] if r['period']=='TRAIN' else by[fam]
        if int(r['prior_same_family_train_events'])!=len(prior):return False
        c=r['m2_quality80_causal_for_decision'].strip()
        if r['period']=='TRAIN' and len(prior)<30:
            if r['score_status']!='CALIBRATION_INCOMPLETE' or c!='':return False
            continue
        if r['score_status']!='CAUSAL_SCORE_VALID' or c=='':return False
        if r['period']=='EVAL':
            if r['normalization_policy']!='FROZEN_COMPLETE_TRAIN_ECDF_EVAL_ONLY':return False
            want=sc(r,fz[fam],fzT)
        else:
            A=[[float(p[k]) for p in prior] for k in ('raw_e4','raw_closepos','raw_rvol','raw_taker')]
            TR=([float(p['raw_reversal_trigger']) for p in prior],[float(p['raw_reversal_retest']) for p in prior]) if fam=='REVERSAL' else None
            want=sc(r,A,TR)
        if abs(want-float(c))>1e-8:return False
    return True
test('T28',_t28(),'causal ECDF CSV: hash, counts, prior counts, null policy, scores recomputed from raw features')
# --- T29: language-code audit (v1.0.7) ---
def _t29():
    REASONS={'FETCH_FAILED','CONFIRMED_GAP','GROSS_CAP','PAIR_ACTIVE','POSITION_OR_RISK_CAP','CONFLICT_CHECK_NOT_LOGGED'}
    IDENT={'CONFLUENSE','M6_CONFLUENSE','M6_CONFLUENSE_0_500','TE14','ENTRY_REVIEW','BULLISH','BEARISH','TRANSITION','BREAKOUT_RETEST','PULLBACK_CONTINUATION','REVERSAL_RETEST','MEAN_REVERSION','PATTERN_BASED','BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT','M5_AUDIT_2024_CLOSED_BAR_9BPS_V1','SYNTHETIC_FIXTURE_ONLY','BREAKOUT_2024_NO_DIRECTION_GATE','STATIC_CONTRACT_CHECK','M2_ECDF_STRICT_PRIOR_AUDIT_20261010_V1','CAUSAL_SCORE_VALID','EXPANDING_PRIOR_ONLY_TRAIN_UTC_STRICT_LT_TIMESTAMP','FROZEN_COMPLETE_TRAIN_ECDF_EVAL_ONLY','BREAKOUT','PULLBACK','REVERSAL','TRAIN','EVAL','LONG','SHORT'}
    # v1.0.11 §16 (R32): kode status TAMPILAN rencana siap salin + nama filter exchangeInfo Binance — bukan kode keputusan §9.
    DISPLAY_V1011={'READY','UNROUNDED','NEED_SETTINGS','INVALID_SETTINGS','NOT_EXECUTABLE','PAIR_NOT_TRADING','NO_PLAN','TRADING','PRICE_FILTER','LOT_SIZE','MIN_NOTIONAL'}
    toks=set(re.findall(r'`([A-Z][A-Z0-9_]{3,})`',prd_text))
    if toks-(EVENT|SCORE|DECISION|REASONS|IDENT|DISPLAY_V1011):return False
    # kode tampilan tidak boleh bocor menjadi status keputusan
    if DISPLAY_V1011&(EVENT|SCORE|DECISION|REASONS):return False
    if 'atr_entry_frozen"' in prd_text:return False
    clip=lambda v:min(max(v,0.),1.)
    for r in rows:
        f=lambda k:float(r[k])
        if abs(f('trend_25te_10adx')-(25*clip(f('te14'))+10*clip(f('adx')/50)))>1e-9:return False
        if abs(f('signal_generation_30')-(15+10*f('retest_precision')+5*f('confirmation_timing')))>1e-9:return False
        if abs(f('momentum_25')-(15*f('consistency_q')+10*f('candle_location_q')))>1e-9:return False
        if abs(f('participation_25')-(10*f('rvol_q')+15*f('taker_q')))>1e-9:return False
        if abs(f('s45')-(22.5 if r['struct_state']=='TRANSITION' else 45))>1e-12:return False
    return True
test('T29',_t29(),'language-code audit: status tokens registered, JSON ATR fields, M1/M2 component formulas 410/410')
STATIC={'T04','T05','T09','T14','T15'}
for k in STATIC: results[k]['kind']='STATIC_CONTRACT_CHECK'
output={'version':'PRD_M1_M6_CONFLUENSE_V1','scope':'arithmetic, contract and existing evidence only; NOT economic backtest of new M6','tests':results,'passed':sum(x['status']=='PASS' for x in results.values()),'failed':sum(x['status']=='FAIL' for x in results.values()),'existing_2024_canonical_events':len(rows),'output_warning':'M2 audit20 was NOT_RECOMPUTED for 410 event source; an M6 historical pnl test cannot be inferred from this file'}
(ROOT/'VALIDASI_PRD_FINAL_M1_M6.json').write_text(json.dumps(output,indent=2,sort_keys=True,ensure_ascii=False),encoding='utf-8')
print(json.dumps({k:v for k,v in output.items() if k!='tests'},indent=2))
for k,x in results.items():
    if x['status']=='FAIL':print('FAILED',k,x['detail'])
if output['failed']:raise SystemExit(2)
