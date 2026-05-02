export const INITIAL_TASKS = [
  {
    id: 't1', title: 'Assignment 1: History Essay', progress: 40, status: 'pending', date: '2026-02-25',
    desc: 'Complete the final draft for the History 101 assignment covering the industrial revolution. Must include at least 5 primary sources and follow Chicago formatting.',
    children: [
      {
        id: 't1-1', title: 'Research primary sources', progress: 100, status: 'done',
        desc: 'Find at least 3 primary sources from the university library database regarding textile factories and labor conditions.',
        children: []
      },
      {
        id: 't1-2', title: 'Draft body paragraphs', progress: 20, status: 'pending',
        desc: 'Write 3 paragraphs focusing on social impact, economic shift, and technological advancements during the 18th century.',
        children: [
           { id: 't1-2-1', title: 'Outline social impact', progress: 0, status: 'pending', desc: 'Detail the shift from agrarian lifestyle to urban slums. Mention the working class struggles.' },
           { id: 't1-2-2', title: 'Draft economic shift section', progress: 0, status: 'pending', desc: 'Focus on the transition to mass production and the rise of factory owners. 250 words minimum.' },
           { id: 't1-2-3', title: 'Review flow and transitions', progress: 0, status: 'pending', desc: 'Ensure paragraph 1 seamlessly connects to paragraph 2 using appropriate transition words.' }
        ]
      },
      {
        id: 't1-3', title: 'Proofread & Format', progress: 0, status: 'pending',
        desc: 'Run through Grammarly, check Chicago style citations, and generate the final bibliography page.',
        children: []
      }
    ]
  },
  {
    id: 't2', title: 'Team Sync Preparation', progress: 60, status: 'pending', date: '2026-02-26',
    desc: 'Prepare the slide deck and discussion points for the weekly marketing sync.',
    children: []
  },
  {
    id: 't3', title: 'Read Chapter 3', progress: 0, status: 'pending', date: '2026-02-24',
    desc: 'Read chapter 3 of the Biology textbook regarding cellular respiration.',
    children: []
  },
  {
    id: 't4', title: 'Study for Math Midterm', progress: 15, status: 'pending', date: '2026-03-02',
    desc: 'Review all calculus notes from week 1 to 5. Practice integration problems.',
    children: []
  }
];

export const INITIAL_STATS = {
  focusTimeToday: 185, // minutes
  sessions: 4,
  avgSession: 46, // minutes
  completionRate: 78, // percent
  topDistractions: ['Instagram', 'TikTok', 'Email'],
  distractCount: 5,
  distractTime: 25, // minutes
  peakFocusTime: '10:00 AM - 12:00 PM',
  streak: 12, // days
  focusScore: 600,
  maxScore: 1000
};

export const INITIAL_EVENTS = [
  { id: 1, time: '09:00 AM', type: 'focus', desc: 'Started Focus Session' },
  { id: 2, time: '10:15 AM', type: 'distract', desc: 'Distracted → Instagram (5m)' },
  { id: 3, time: '10:20 AM', type: 'focus', desc: 'Back to Focus' },
  { id: 4, time: '11:45 AM', type: 'distract', desc: 'Distracted → Email (10m)' },
  { id: 5, time: '11:55 AM', type: 'focus', desc: 'Back to Focus' },
];



export const DEFAULT_NOTES = [
  { id: 'n1', text: 'Ask professor about the extension for the essay.', time: '10:00 AM' },
  { id: 'n2', text: 'Buy milk and coffee beans later.', time: '11:30 AM' }
];
