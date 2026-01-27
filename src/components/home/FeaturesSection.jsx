import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, CreditCard, Headphones, Plane, Sparkles } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: Shield,
      title: 'حجز آمن 100%',
      description: 'نظام دفع آمن ومحمي بأحدث تقنيات التشفير العالمية',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Clock,
      title: 'حجز فوري',
      description: 'احجز تذكرتك في دقائق واستلم التأكيد فوراً على واتساب',
      color: 'from-green-500 to-emerald-600'
    },
    {
      icon: CreditCard,
      title: 'طرق دفع متعددة',
      description: 'ادفع بالبطاقة البنكية أو المحفظة الإلكترونية بسهولة',
      color: 'from-purple-500 to-violet-600'
    },
    {
      icon: Headphones,
      title: 'دعم على مدار الساعة',
      description: 'فريق دعم متاح لمساعدتك في أي وقت عبر واتساب',
      color: 'from-orange-500 to-amber-600'
    },
    {
      icon: Plane,
      title: 'أفضل الأسعار',
      description: 'نضمن لك أفضل الأسعار من جميع شركات الطيران المعتمدة',
      color: 'from-pink-500 to-rose-600'
    },
    {
      icon: Sparkles,
      title: 'ذكاء اصطناعي',
      description: 'مساعد ذكي يساعدك في إيجاد أفضل الرحلات لك',
      color: 'from-indigo-500 to-blue-600'
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            لماذا تختارنا؟
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            نقدم لك تجربة حجز استثنائية مع أفضل الخدمات والأسعار
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="bg-white rounded-3xl p-8 shadow-sm border hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.color} text-white mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}