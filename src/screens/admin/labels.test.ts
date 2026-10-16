import { describe, expect, it } from 'vitest';
import {
  incomeSourceLabel,
  packageLabel,
  partnerLabel,
  paymentMethodLabel,
  planLabel,
  timeAgo,
  PARTNER_NYO,
  PARTNER_VISION_CONTABLE,
} from './labels';

describe('labels (Story 8.8 AC #12, Story 10.6)', () => {
  describe('packageLabel', () => {
    it('traduce códigos de paquete a nombres legibles', () => {
      expect(packageLabel('CON_IVA')).toBe('Con IVA');
      expect(packageLabel('SIN_IVA')).toBe('Sin IVA');
    });

    it('maneja valores vacíos con raya', () => {
      expect(packageLabel(null)).toBe('—');
      expect(packageLabel(undefined)).toBe('—');
      expect(packageLabel('')).toBe('—');
    });
  });

  describe('incomeSourceLabel', () => {
    it('traduce códigos internos a nombres legibles', () => {
      expect(incomeSourceLabel('DIAN')).toBe('Factura electrónica');
      expect(incomeSourceLabel('MANUAL_SALES')).toBe('Ventas');
      expect(incomeSourceLabel('MIXED')).toBe('Mixto (factura + ventas)');
    });

    it('maneja valores vacíos o nulos con raya', () => {
      expect(incomeSourceLabel(null)).toBe('—');
      expect(incomeSourceLabel(undefined)).toBe('—');
      expect(incomeSourceLabel('')).toBe('—');
    });

    it('devuelve valor original si no coincide con los conocidos', () => {
      expect(incomeSourceLabel('OTRO_ORIGEN')).toBe('OTRO_ORIGEN');
    });
  });

  describe('partnerLabel', () => {
    it('traduce códigos de socios', () => {
      expect(partnerLabel('VISION_CONTABLE')).toBe(PARTNER_VISION_CONTABLE);
      expect(partnerLabel('NYO')).toBe(PARTNER_NYO);
    });
  });

  describe('planLabel', () => {
    it('devuelve el nombre del plan cuando se pasa la lista de planes', () => {
      const plans = [
        { code: 'TRIMESTRAL', name: 'Plan Trimestral Emprendedor' },
        { code: 'SEMESTRAL', name: 'Plan Semestral Negocio' },
      ];
      expect(planLabel('TRIMESTRAL', plans)).toBe('Plan Trimestral Emprendedor');
      expect(planLabel('SEMESTRAL', plans)).toBe('Plan Semestral Negocio');
    });

    it('formatea el código en formato título si no se encuentra en la lista o no se pasa lista', () => {
      expect(planLabel('TRIMESTRAL')).toBe('Trimestral');
      expect(planLabel('SEMESTRAL')).toBe('Semestral');
      expect(planLabel('ANUAL')).toBe('Anual');
      expect(planLabel('SEMESTRAL_PLUS')).toBe('Semestral Plus');
      expect(planLabel('DESCONOCIDO', [])).toBe('Desconocido');
    });

    it('maneja valores vacíos o nulos con raya', () => {
      expect(planLabel(null)).toBe('—');
      expect(planLabel(undefined)).toBe('—');
      expect(planLabel('')).toBe('—');
    });
  });

  describe('paymentMethodLabel', () => {
    it('traduce TRANSFERENCIA a Transferencia', () => {
      expect(paymentMethodLabel('TRANSFERENCIA')).toBe('Transferencia');
      expect(paymentMethodLabel('EFECTIVO')).toBe('Efectivo');
      expect(paymentMethodLabel('TARJETA')).toBe('Tarjeta');
    });

    it('maneja valores vacíos con raya', () => {
      expect(paymentMethodLabel(null)).toBe('—');
      expect(paymentMethodLabel(undefined)).toBe('—');
      expect(paymentMethodLabel('')).toBe('—');
    });

    it('formatea otros métodos a formato título', () => {
      expect(paymentMethodLabel('CONSIGNACION_BANCARIA')).toBe('Consignacion Bancaria');
    });
  });

  describe('timeAgo', () => {
    it('devuelve "hace un momento" para menos de 1 minuto', () => {
      expect(timeAgo(0)).toBe('hace un momento');
      expect(timeAgo(0.5)).toBe('hace un momento');
      expect(timeAgo(-2)).toBe('hace un momento');
    });

    it('devuelve "hace N min" para menos de 60 minutos', () => {
      expect(timeAgo(1)).toBe('hace 1 min');
      expect(timeAgo(4)).toBe('hace 4 min');
      expect(timeAgo(59)).toBe('hace 59 min');
    });

    it('devuelve "hace N h" para menos de 24 horas (1440 min)', () => {
      expect(timeAgo(60)).toBe('hace 1 h');
      expect(timeAgo(120)).toBe('hace 2 h');
      expect(timeAgo(300)).toBe('hace 5 h');
      expect(timeAgo(1439)).toBe('hace 23 h');
    });

    it('devuelve "hace N días" para 24 horas o más', () => {
      expect(timeAgo(1440)).toBe('hace 1 día');
      expect(timeAgo(2880)).toBe('hace 2 días');
      expect(timeAgo(5221)).toBe('hace 3 días');
      expect(timeAgo(10000)).toBe('hace 6 días');
    });

    it('devuelve "sin señal" para null, undefined o NaN', () => {
      expect(timeAgo(null)).toBe('sin señal');
      expect(timeAgo(undefined)).toBe('sin señal');
      expect(timeAgo(NaN)).toBe('sin señal');
    });
  });
});
