"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  buildPeriodoOptions,
  getSubPeriodos,
  PERIODICIDAD_LABEL,
  PERIODO_TIPO_LABEL,
  type Periodicidad,
  type PeriodoTipo,
} from "@/lib/types/informes"

export interface PeriodoValue {
  periodicidad: Periodicidad
  periodo_tipo: PeriodoTipo
  anio: number
  sub_periodo: string | null
}

interface PeriodoSelectorProps {
  value: PeriodoValue
  onChange: (value: PeriodoValue) => void
}

export function PeriodoSelector({ value, onChange }: PeriodoSelectorProps) {
  const subPeriodos = getSubPeriodos(value.periodicidad)
  const periodoOptions = buildPeriodoOptions(value.periodo_tipo)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Periodicidad</Label>
        <Select
          value={value.periodicidad}
          onValueChange={(v) => {
            const periodicidad = v as Periodicidad
            const subs = getSubPeriodos(periodicidad)
            onChange({
              ...value,
              periodicidad,
              sub_periodo: subs.length > 0 ? subs[0].value : null,
            })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIODICIDAD_LABEL) as Periodicidad[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIODICIDAD_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de periodo</Label>
        <Select
          value={value.periodo_tipo}
          onValueChange={(v) => onChange({ ...value, periodo_tipo: v as PeriodoTipo })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIODO_TIPO_LABEL) as PeriodoTipo[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIODO_TIPO_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">
          {value.periodo_tipo === "curso" ? "Curso" : "Año"}
        </Label>
        <Select
          value={String(value.anio)}
          onValueChange={(v) => onChange({ ...value, anio: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodoOptions.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {subPeriodos.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Sub-periodo</Label>
          <Select
            value={value.sub_periodo ?? subPeriodos[0].value}
            onValueChange={(v) => onChange({ ...value, sub_periodo: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subPeriodos.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
