const SKILL_NAMES: Record<number, string> = {
  0: 'Smart Contract Development',
  1: 'Frontend Development',
  2: 'Backend Development',
  3: 'UI/UX Design',
  4: 'Security Audit',
  5: 'Technical Writing',
  6: 'Data Labeling',
  7: 'QA/Testing',
}

interface SkillTagsProps {
  skillBitmask: bigint
}

export default function SkillTags({ skillBitmask }: SkillTagsProps) {
  const skills: string[] = []

  for (let i = 0; i < 8; i++) {
    if ((skillBitmask & (BigInt(1) << BigInt(i))) !== BigInt(0)) {
      skills.push(SKILL_NAMES[i])
    }
  }

  if (skills.length === 0) {
    return <span className="text-sm text-gray-500">No skills listed</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span
          key={skill}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
        >
          {skill}
        </span>
      ))}
    </div>
  )
}
