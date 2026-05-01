interface Transition {
  stay_prob: number;
  switch_prob: number;
  expected_duration_days: number;
  current_duration_days: number;
}

interface Props {
  transition: Transition;
  regime: string;
}

export default function TransitionStats({ transition, regime}: Props) {

  return (
    <div className="transition-stats p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Regime transition probabilities
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Current streak</p>
          <p className="text-2xl font-bold text-white">
            {transition.current_duration_days}
            <span className="text-sm text-gray-400 ml-1"> days</span>
          </p>
        </div>
        <div className="card bg-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Stay probability</p>
          <p className="text-2xl font-bold text-white">
            {transition.stay_prob}%
          </p>
        </div>
        <div className="card bg-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Switch probability</p>
          <p className="text-2xl font-bold text-gray-300">
            {transition.switch_prob}%
          </p>
        </div>
        <div className="card bg-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Expected duration</p>
          <p className="text-2xl font-bold text-white">
            {transition.expected_duration_days}
            <span className="text-sm text-gray-400 ml-1"> days</span>
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-3">
        Derived from HMM transition matrix · directly comparable to CTMSTOU calibrated rates (λ=2.90, ω=0.812 events/day)
      </p>
    </div>
  );
}