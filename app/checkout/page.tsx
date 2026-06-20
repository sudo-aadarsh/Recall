'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { ShieldCheck, Check, ArrowLeft, Loader2, CreditCard } from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams?.get('plan') || '3m';
  
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  
  let planName = '3 Months Premium';
  let price = '$2.50';
  if (plan === '1m') { planName = '1 Month Premium'; price = '$1.00'; }
  if (plan === '6m') { planName = '6 Months Premium'; price = '$4.50'; }
  if (plan === '1y') { planName = '1 Year Premium'; price = '$8.00'; }

  function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
    }, 2000);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans neural-bg w-full relative" style={{ background: 'var(--bg-base)' }}>
        <div className="glass max-w-md w-full p-8 rounded-2xl text-center" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'var(--bg-surface)' }}>
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} />
          </div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Payment Successful!</h1>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Thank you for upgrading to {planName}. Your premium features are now unlocked.</p>
          <Link href="/dashboard" className="btn-primary w-full py-3 justify-center text-lg inline-flex">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans neural-bg w-full relative" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative z-0 mt-12 md:mt-0">
        {/* Order Summary */}
        <div className="relative">
          <Link href="/dashboard" className="absolute -top-10 left-0 flex items-center gap-2 transition-colors font-medium hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="glass p-8 rounded-2xl" style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'var(--bg-surface)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Order Summary</h2>
          
          <div className="flex justify-between items-center pb-4 border-b mb-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="text-lg font-medium text-amber-500">{planName}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Billed immediately</div>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{price}</div>
          </div>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span style={{ color: 'var(--text-primary)' }}>{price}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Tax</span>
              <span style={{ color: 'var(--text-primary)' }}>$0.00</span>
            </div>
            <div className="flex justify-between font-bold pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-primary)' }}>Total due today</span>
              <span className="text-amber-500 text-xl">{price}</span>
            </div>
          </div>
          
          <div className="rounded-xl p-4 text-sm flex items-start gap-3 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <ShieldCheck className="text-emerald-500 flex-shrink-0" size={20} />
            <p>Guaranteed safe & secure checkout. Payments are encrypted and fully protected by our payment processor.</p>
          </div>
        </div>
      </div>
        
        {/* Payment Form */}
        <div className="glass p-8 rounded-2xl" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Payment Details</h2>
          
          <form onSubmit={handlePayment} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Card Information</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--text-muted)' }} />
                <input required type="text" placeholder="Card number" 
                  className="w-full border rounded-lg py-3 pl-10 pr-4 transition-colors mb-3 focus:outline-none focus:border-amber-500" 
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input required type="text" placeholder="MM / YY" 
                  className="w-full border rounded-lg py-3 px-4 transition-colors focus:outline-none focus:border-amber-500" 
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                <input required type="text" placeholder="CVC" 
                  className="w-full border rounded-lg py-3 px-4 transition-colors focus:outline-none focus:border-amber-500" 
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name on card</label>
              <input required type="text" placeholder="Full name" 
                className="w-full border rounded-lg py-3 px-4 transition-colors focus:outline-none focus:border-amber-500" 
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Country or region</label>
              <select className="w-full border rounded-lg py-3 px-4 transition-colors appearance-none focus:outline-none focus:border-amber-500" 
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Canada</option>
                <option>Australia</option>
                <option>India</option>
                <option>Other</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={processing}
              className="w-full btn-primary py-4 text-lg font-bold justify-center rounded-xl mt-6 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2" 
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FB923C)', boxShadow: '0 8px 20px rgba(245,158,11,0.3)' }}
            >
              {processing ? (
                <><Loader2 className="animate-spin" /> Processing...</>
              ) : (
                `Pay ${price}`
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}><Loader2 className="animate-spin" size={32} /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
