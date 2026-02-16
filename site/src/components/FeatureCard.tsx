interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group border border-border-strong bg-bg p-6 hover:border-white transition-colors duration-300">
      <div className="text-2xl text-white mb-4">{icon}</div>
      <div className="text-white mb-2 font-bold text-lg uppercase">
        {title}
      </div>
      <p className="text-sm text-dim leading-relaxed">{description}</p>
    </div>
  );
}
