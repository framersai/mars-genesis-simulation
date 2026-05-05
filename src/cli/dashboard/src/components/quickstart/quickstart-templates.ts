/**
 * Pre-written Quickstart scenario seeds — same five templates the
 * marketing landing page surfaces as `?prompt=` chips, but exported as
 * structured data so the dashboard's SeedInput can mount them in a
 * dropdown picker. Visitors who land directly on /sim no longer have
 * to bounce back to the landing page to grab a sample prompt.
 *
 * If the landing-page chip list changes, mirror the change here. The
 * label is what shows in the dropdown; the seedText is the full prompt
 * that lands in the textarea on selection.
 *
 * @module paracosm/dashboard/quickstart/quickstart-templates
 */

export interface QuickstartTemplate {
  /** Stable id used for telemetry + as the React key. */
  id: string;
  /** Short "What if …?" label that appears in the dropdown. */
  label: string;
  /** Full seed text that populates the WRITE textarea on selection. */
  seedText: string;
}

export const QUICKSTART_TEMPLATES: ReadonlyArray<QuickstartTemplate> = [
  {
    id: 'hurricane-evacuation',
    label: 'What if a coastal mayor has 36 hours to evacuate before a hurricane?',
    seedText: 'A coastal metro of 800,000 has 36 hours before a Category 4 hurricane landfall. The mayor must decide a phased evacuation across three districts served by a single causeway bridge, with a regional hospital, a fuel depot, and an aging levee system in play. Departments involved: emergency management, public health, transportation, utilities, communications.',
  },
  {
    id: 'saas-mid-tier',
    label: 'What if a SaaS adds a new mid-tier price mid-funnel?',
    seedText: 'A mid-stage SaaS with 180,000 paid users introduces a new $14/month mid-tier pricing bracket between Free and the existing $29 Pro. Existing Pro subs get 90-day grandfathering. Test the impact on Free-to-Paid conversion, Pro downgrade rate, net ARPU, and churn over six months. Departments: pricing, growth, success, finance, engineering.',
  },
  {
    id: 'ai-lab-early-release',
    label: 'What if an AI lab releases a frontier model six weeks early?',
    seedText: "An AI lab decides whether to release a frontier multimodal model six weeks early. Two evaluators flag a 4.2% specification-gaming rate on long-horizon agentic tasks and early mesa-objective signals under DPO. A rival lab's weaker model ships on schedule, capturing $240M ARR in enterprise deals. Council: alignment, capability, policy, infra, comms.",
  },
  {
    id: 'generation-ship-fuel-leak',
    label: 'What if a generation ship discovers a fuel leak at year 18?',
    seedText: 'A generation ship with 2,400 passengers at year 18 of a 40-year interstellar transit discovers a slow fuel leak on the main reactor. Reactor crew wants to EVA-repair (non-zero fatality risk); bridge wants to coast at reduced thrust and accept a 14-year transit extension. Departments: engineering, life support, medical, psych, command.',
  },
  {
    id: 'city-congestion-pricing',
    label: 'What if a city pilots congestion pricing for 12 months?',
    seedText: 'A mid-size city of 650,000 pilots downtown congestion pricing for 12 months. $9 peak / $3 off-peak on vehicles entering the central business district 6am-7pm Mon-Fri. Revenue funds two BRT lines and a 30% transit fare cut for low-income riders. Test VMT, transit ridership, small-business revenue, equity outcomes.',
  },
];
