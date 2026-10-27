import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "./ui/button";

const ZONE = "Europe/Bratislava";
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function wallParts(value: string): Parts | null {
  const match = DATE_RE.exec(value);
  if (match && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return { year:+match[1],month:+match[2],day:+match[3],hour:+match[4],minute:+match[5] };
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).formatToParts(date).map(part=>[part.type,part.value]));
  return {year:+parts.year,month:+parts.month,day:+parts.day,hour:+parts.hour,minute:+parts.minute};
}
function keyOf({year,month,day}:Parts) {
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
function dateParts(key: string) {
  const [year,month,day]=key.split("-").map(Number);
  return {year,month,day};
}
function dateKeyInZone(date: Date) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function weekday(key: string) {
  const {year,month,day}=dateParts(key);
  return new Date(Date.UTC(year,month-1,day)).getUTCDay();
}
function wallTimeToUtc(key: string,time: string) {
  const {year,month,day}=dateParts(key),[hour,minute]=time.split(":").map(Number);
  const target=Date.UTC(year,month-1,day,hour,minute);
  let guess=target;
  for(let i=0;i<3;i++) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
    }).formatToParts(new Date(guess)).map(part=>[part.type,part.value]));
    guess+=target-Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute);
  }
  return new Date(guess);
}

export function StatusListCallbackRescheduleFields({
  value,onChange,locale,copy,testId="status-list-recap",businessDaysOnly=true,
}:{
  value:string;onChange:(value:string)=>void;locale:string;
  copy:{newDate:string;time:string;time24Hour:string;previousWeekday:string;nextWeekday:string};
  testId?:string;
  businessDaysOnly?:boolean;
}) {
  const today=useMemo(()=>dateKeyInZone(new Date()),[]);
  const initial=wallParts(value) || wallParts(`${today}T09:00`);
  const [dateKey,setDateKey]=useState(keyOf(initial!));
  const [time,setTime]=useState(`${String(initial!.hour).padStart(2,"0")}:${String(initial!.minute).padStart(2,"0")}`);
  useEffect(()=>{
    const parts=wallParts(value);
    if(parts) {setDateKey(keyOf(parts));setTime(`${String(parts.hour).padStart(2,"0")}:${String(parts.minute).padStart(2,"0")}`);}
  },[value]);
  const {year:selectedYear,month:selectedMonth,day:selectedDay}=dateParts(dateKey);
  const now=Date.now();
  const validKeys=(year:number,month:number)=> {
    const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
    return Array.from({length:lastDay},(_,index)=>keyOf({year,month,day:index+1,hour:0,minute:0}))
      .filter(key=>(!businessDaysOnly || weekday(key)>0 && weekday(key)<6) && wallTimeToUtc(key,time).getTime()>now);
  };
  const available=validKeys(selectedYear,selectedMonth);
  if(!available.includes(dateKey) && (!businessDaysOnly || weekday(dateKey)>0 && weekday(dateKey)<6) &&
    wallTimeToUtc(dateKey,time).getTime()>now) available.unshift(dateKey);
  const changeDate=(key:string)=>{
    const {year,month}=dateParts(key);
    if(!validKeys(year,month).includes(key)) return;
    setDateKey(key);onChange(wallTimeToUtc(key,time).toISOString());
  };
  const changeTime=(nextTime:string)=>{
    if(wallTimeToUtc(dateKey,nextTime).getTime()<=Date.now())return;
    setTime(nextTime);
    onChange(wallTimeToUtc(dateKey,nextTime).toISOString());
  };
  const currentYear=Number(today.slice(0,4));
  const years=Array.from(new Set([...Array.from({length:7},(_,index)=>currentYear+index),selectedYear])).sort((a,b)=>a-b);
  const monthName=(month:number)=>new Intl.DateTimeFormat(locale,{timeZone:"UTC",month:"short"}).format(new Date(Date.UTC(2024,month-1,1)));
  const weekdays=Array.from({length:7},(_,index)=>new Intl.DateTimeFormat(locale,{timeZone:"UTC",weekday:"short"}).format(new Date(Date.UTC(2024,0,1+index))));
  const shortcuts=useMemo(()=>{
    const values:string[]=[];const cursor=new Date(`${today}T12:00:00Z`);
    while(values.length<3) {
      const key=keyOf({year:cursor.getUTCFullYear(),month:cursor.getUTCMonth()+1,day:cursor.getUTCDate(),hour:0,minute:0});
      if(weekday(key)>0&&weekday(key)<6&&wallTimeToUtc(key,time).getTime()>Date.now())values.push(key);
      cursor.setUTCDate(cursor.getUTCDate()+1);
      if(cursor.getTime()>Date.now()+14*86400000)break;
    }
    return values;
  },[today,time]);
  const moveWeekday=(direction:-1|1)=>{
    const cursor=new Date(`${dateKey}T12:00:00Z`);
    for(let step=0;step<370;step++) {
      cursor.setUTCDate(cursor.getUTCDate()+direction);
      const key=keyOf({year:cursor.getUTCFullYear(),month:cursor.getUTCMonth()+1,day:cursor.getUTCDate(),hour:0,minute:0});
      if(weekday(key)>0&&weekday(key)<6&&wallTimeToUtc(key,time).getTime()>Date.now()){changeDate(key);return;}
    }
  };
  const setDatePart=(part:"day"|"month"|"year",next:number)=>{
    const year=part==="year"?next:selectedYear,month=part==="month"?next:selectedMonth,day=part==="day"?next:selectedDay;
    const candidates=validKeys(year,month),wanted=keyOf({year,month,day,hour:0,minute:0});
    const nextKey=candidates.includes(wanted)?wanted:candidates.find(key=>Number(key.slice(-2))>=day)||candidates[candidates.length-1];
    if(nextKey)changeDate(nextKey);
  };
  const dayOptions=available.map(key=>Number(key.slice(-2)));
  const monthOptions=Array.from({length:12},(_,index)=>index+1);
  const hour=time.slice(0,2),minute=time.slice(3);
  const dateLabel=(key:string)=> {
    return new Intl.DateTimeFormat(locale,{timeZone:ZONE,weekday:"short",day:"numeric",month:"short"})
      .format(wallTimeToUtc(key,"12:00"));
  };
  return <div className="space-y-3 rounded-xl border border-[#dce8f1] bg-[#fbfdff] p-3 dark:border-slate-700 dark:bg-slate-900/60" data-testid={`${testId}-rescheduler`}>
    <div>
      <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7891a5]">{copy.newDate}</p>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="h-7 w-6 shrink-0 border-[#c7dbe9] p-0 sm:h-8 sm:w-8" onClick={()=>moveWeekday(-1)} aria-label={copy.previousWeekday}>
          <ChevronLeft className="h-4 w-4"/>
        </Button>
        <div className="flex h-10 min-w-0 flex-1 items-center gap-0.5 rounded-lg border border-[#9fc4dc] bg-[#eaf3fb] px-1 text-[#1c568f] sm:gap-1 sm:px-2">
          <Calendar className="h-3 w-3 shrink-0 text-[#2d6fba] sm:h-3.5 sm:w-3.5"/>
          <select aria-label={`${copy.newDate}: ${selectedDay}`} data-testid={`${testId}-day`} value={selectedDay} onChange={event=>setDatePart("day",Number(event.target.value))} className="w-9 shrink-0 bg-transparent text-center text-xs font-bold outline-none sm:text-sm">
            {dayOptions.map(day=><option key={day} value={day}>{String(day).padStart(2,"0")}</option>)}
          </select>
          <span className="h-5 w-px bg-[#b9d8ed]"/>
          <select aria-label={`${copy.newDate}: ${monthName(selectedMonth)}`} data-testid={`${testId}-month`} value={selectedMonth} onChange={event=>setDatePart("month",Number(event.target.value))} className="min-w-[3.25rem] flex-1 bg-transparent text-center text-xs font-bold outline-none sm:text-sm">
            {monthOptions.map(month=><option key={month} value={month} disabled={!validKeys(selectedYear,month).length}>{monthName(month)}</option>)}
          </select>
          <span className="h-5 w-px bg-[#b9d8ed]"/>
          <select aria-label={`${copy.newDate}: ${selectedYear}`} data-testid={`${testId}-year`} value={selectedYear} onChange={event=>setDatePart("year",Number(event.target.value))} className="w-[3.5rem] shrink-0 bg-transparent text-center text-xs font-bold outline-none sm:text-sm">
            {years.map(year=><option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <Button type="button" variant="outline" size="icon" className="h-7 w-6 shrink-0 border-[#c7dbe9] p-0 sm:h-8 sm:w-8" onClick={()=>moveWeekday(1)} aria-label={copy.nextWeekday}>
          <ChevronRight className="h-4 w-4"/>
        </Button>
      </div>
      <p className="mt-1 text-center text-[9px] font-semibold text-[#7089a0]">{dateLabel(dateKey)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {shortcuts.map(key=><button type="button" key={key} onClick={()=>changeDate(key)} className={`rounded-md border px-2 py-1 text-[10px] ${key===dateKey?"border-[#9fc4dc] bg-[#eaf3fb] font-bold text-[#1c568f]":"border-[#dce8f1] text-[#7089a0]"}`}>{dateLabel(key)}</button>)}
      </div>
    </div>
    <div>
      <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7891a5]">{copy.time}</p>
      <div className="flex items-center gap-2 rounded-lg border border-[#c7dbe9] bg-[#f7fbfe] px-3 py-2">
        <Clock className="h-4 w-4 text-[#2d6fba]"/>
        <select aria-label={`${copy.time} ${hour}`} data-testid={`${testId}-hour`} value={hour} onChange={event=>changeTime(`${event.target.value}:${minute}`)} className="bg-transparent text-sm font-bold text-[#1d3d5a] outline-none">
          {Array.from({length:24},(_,n)=>{const value=String(n).padStart(2,"0");return <option key={n} disabled={wallTimeToUtc(dateKey,`${value}:${minute}`).getTime()<=Date.now()}>{value}</option>;})}
        </select>
        <span className="font-bold text-[#1d3d5a]">:</span>
        <select aria-label={`${copy.time} ${minute}`} data-testid={`${testId}-minute`} value={minute} onChange={event=>changeTime(`${hour}:${event.target.value}`)} className="bg-transparent text-sm font-bold text-[#1d3d5a] outline-none">
          {Array.from({length:60},(_,n)=>{const value=String(n).padStart(2,"0");return <option key={n} disabled={wallTimeToUtc(dateKey,`${hour}:${value}`).getTime()<=Date.now()}>{value}</option>;})}
        </select>
        <span className="ml-auto text-[9px] text-[#7891a5]">{copy.time24Hour}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["09:00","10:30","13:00","14:30","16:00"].map(slot=><button type="button" key={slot} disabled={wallTimeToUtc(dateKey,slot).getTime()<=Date.now()} onClick={()=>changeTime(slot)} className={`rounded-md border px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${slot===time?"border-[#9fc4dc] bg-[#eaf3fb] font-bold text-[#1c568f]":"border-[#dce8f1] text-[#7089a0]"}`}>{slot}</button>)}
      </div>
    </div>
  </div>;
}
