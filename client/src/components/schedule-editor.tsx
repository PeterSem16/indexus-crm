import { useState, useEffect } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

export interface WeeklySchedule {
  [key: number]: DaySchedule;
}

export interface ScheduleConfig {
  maxAttemptsPerContact: number;
  minHoursBetweenAttempts: number;
  weeklySchedule: WeeklySchedule;
}

interface DayOfWeek {
  value: number;
  label: string;
  short: string;
}

interface ScheduleEditorProps {
  schedule: ScheduleConfig;
  onChange: (schedule: ScheduleConfig) => void;
  readonly?: boolean;
}

function getDefaultSchedule(): WeeklySchedule {
  const schedule: WeeklySchedule = {};
  for (let i = 0; i < 7; i++) {
    schedule[i] = {
      enabled: i >= 1 && i <= 5,
      slots: i >= 1 && i <= 5 ? [{ startTime: "09:00", endTime: "17:00" }] : [],
    };
  }
  return schedule;
}

export function getDefaultScheduleConfig(): ScheduleConfig {
  return {
    maxAttemptsPerContact: 5,
    minHoursBetweenAttempts: 24,
    weeklySchedule: getDefaultSchedule(),
  };
}

function DayRow({
  day,
  schedule,
  onToggle,
  onAddSlot,
  onRemoveSlot,
  onUpdateSlot,
  readonly,
  noTimeSlotsLabel,
  timeToLabel,
  closedDayLabel,
  addSlotLabel,
}: {
  day: DayOfWeek;
  schedule: DaySchedule;
  onToggle: () => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onUpdateSlot: (index: number, slot: TimeSlot) => void;
  readonly?: boolean;
  noTimeSlotsLabel: string;
  timeToLabel: string;
  closedDayLabel: string;
  addSlotLabel: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-0">
      <div className="flex items-center gap-2 w-32">
        <Switch
          checked={schedule.enabled}
          onCheckedChange={onToggle}
          disabled={readonly}
          data-testid={`switch-day-${day.value}`}
        />
        <Label className="font-medium">{day.label}</Label>
      </div>
      
      <div className="flex-1 space-y-2">
        {schedule.enabled ? (
          schedule.slots.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{noTimeSlotsLabel}</p>
          ) : (
            schedule.slots.map((slot, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => onUpdateSlot(index, { ...slot, startTime: e.target.value })}
                  className="w-32"
                  disabled={readonly}
                  data-testid={`input-start-time-${day.value}-${index}`}
                />
                <span className="text-muted-foreground">{timeToLabel}</span>
                <Input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => onUpdateSlot(index, { ...slot, endTime: e.target.value })}
                  className="w-32"
                  disabled={readonly}
                  data-testid={`input-end-time-${day.value}-${index}`}
                />
                {!readonly && schedule.slots.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveSlot(index)}
                    data-testid={`button-remove-slot-${day.value}-${index}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )
        ) : (
          <Badge variant="secondary">{closedDayLabel}</Badge>
        )}
        
        {!readonly && schedule.enabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSlot}
            data-testid={`button-add-slot-${day.value}`}
          >
            <Plus className="w-4 h-4 mr-1" />
            {addSlotLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ScheduleEditor({ schedule, onChange, readonly }: ScheduleEditorProps) {
  const { t } = useI18n();

  const DAYS_OF_WEEK: DayOfWeek[] = [
    { value: 1, label: t.campaigns.detail.weekdays.monLong, short: t.campaigns.detail.weekdays.mon },
    { value: 2, label: t.campaigns.detail.weekdays.tueLong, short: t.campaigns.detail.weekdays.tue },
    { value: 3, label: t.campaigns.detail.weekdays.wedLong, short: t.campaigns.detail.weekdays.wed },
    { value: 4, label: t.campaigns.detail.weekdays.thuLong, short: t.campaigns.detail.weekdays.thu },
    { value: 5, label: t.campaigns.detail.weekdays.friLong, short: t.campaigns.detail.weekdays.fri },
    { value: 6, label: t.campaigns.detail.weekdays.satLong, short: t.campaigns.detail.weekdays.sat },
    { value: 0, label: t.campaigns.detail.weekdays.sunLong, short: t.campaigns.detail.weekdays.sun },
  ];

  const handleDayToggle = (day: number) => {
    const daySchedule = schedule.weeklySchedule[day] || { enabled: false, slots: [] };
    const newSlots = !daySchedule.enabled ? [{ startTime: "09:00", endTime: "17:00" }] : [];
    onChange({
      ...schedule,
      weeklySchedule: {
        ...schedule.weeklySchedule,
        [day]: {
          ...daySchedule,
          enabled: !daySchedule.enabled,
          slots: newSlots,
        },
      },
    });
  };

  const handleAddSlot = (day: number) => {
    const daySchedule = schedule.weeklySchedule[day] || { enabled: true, slots: [] };
    onChange({
      ...schedule,
      weeklySchedule: {
        ...schedule.weeklySchedule,
        [day]: {
          ...daySchedule,
          slots: [...daySchedule.slots, { startTime: "09:00", endTime: "17:00" }],
        },
      },
    });
  };

  const handleRemoveSlot = (day: number, slotIndex: number) => {
    const daySchedule = schedule.weeklySchedule[day];
    if (!daySchedule) return;
    
    onChange({
      ...schedule,
      weeklySchedule: {
        ...schedule.weeklySchedule,
        [day]: {
          ...daySchedule,
          slots: daySchedule.slots.filter((_, i) => i !== slotIndex),
        },
      },
    });
  };

  const handleUpdateSlot = (day: number, slotIndex: number, slot: TimeSlot) => {
    const daySchedule = schedule.weeklySchedule[day];
    if (!daySchedule) return;
    
    const newSlots = [...daySchedule.slots];
    newSlots[slotIndex] = slot;
    
    onChange({
      ...schedule,
      weeklySchedule: {
        ...schedule.weeklySchedule,
        [day]: {
          ...daySchedule,
          slots: newSlots,
        },
      },
    });
  };

  const safeWeekly = schedule.weeklySchedule || {};
  const activeDays = DAYS_OF_WEEK.filter(d => safeWeekly[d.value]?.enabled).length;
  const totalHours = Object.values(safeWeekly).reduce((total: number, day: DaySchedule) => {
    if (!day?.enabled || !Array.isArray(day.slots)) return total;
    return total + day.slots.reduce((slotTotal: number, slot: TimeSlot) => {
      const start = slot.startTime.split(":").map(Number);
      const end = slot.endTime.split(":").map(Number);
      const startMinutes = start[0] * 60 + start[1];
      const endMinutes = end[0] * 60 + end[1];
      return slotTotal + Math.max(0, (endMinutes - startMinutes) / 60);
    }, 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="maxAttempts">{t.campaigns.detail.maxAttempts}</Label>
          <Input
            id="maxAttempts"
            type="number"
            min={1}
            max={20}
            value={schedule.maxAttemptsPerContact}
            onChange={(e) => onChange({ ...schedule, maxAttemptsPerContact: parseInt(e.target.value) || 1 })}
            disabled={readonly}
            data-testid="input-max-attempts"
          />
          <p className="text-xs text-muted-foreground">
            {t.campaigns.detail.stopContactingAfter}
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="minHours">{t.campaigns.detail.minHoursBetween}</Label>
          <Input
            id="minHours"
            type="number"
            min={1}
            max={168}
            value={schedule.minHoursBetweenAttempts}
            onChange={(e) => onChange({ ...schedule, minHoursBetweenAttempts: parseInt(e.target.value) || 1 })}
            disabled={readonly}
            data-testid="input-min-hours"
          />
          <p className="text-xs text-muted-foreground">
            {t.campaigns.detail.waitAtLeastHours}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base">{t.campaigns.detail.workingHours}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{activeDays} {t.campaigns.detail.daysActive}</Badge>
              <Badge variant="outline">{totalHours.toFixed(1)} {t.campaigns.detail.hoursPerWeek}</Badge>
            </div>
          </div>
          <CardDescription>
            {t.campaigns.detail.setWhenOperatorsCanCall}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {DAYS_OF_WEEK.map((day) => (
            <DayRow
              key={day.value}
              day={day}
              schedule={schedule.weeklySchedule[day.value] || { enabled: false, slots: [] }}
              onToggle={() => handleDayToggle(day.value)}
              onAddSlot={() => handleAddSlot(day.value)}
              onRemoveSlot={(index) => handleRemoveSlot(day.value, index)}
              onUpdateSlot={(index, slot) => handleUpdateSlot(day.value, index, slot)}
              readonly={readonly}
              noTimeSlotsLabel={t.campaigns.detail.noTimeSlots}
              timeToLabel={t.campaigns.detail.timeTo}
              closedDayLabel={t.campaigns.detail.closedDay}
              addSlotLabel={t.campaigns.detail.addSlot}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
