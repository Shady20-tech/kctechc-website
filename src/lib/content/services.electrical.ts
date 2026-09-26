import type { ServiceRecord } from "./types";

/**
 * Bundled Electrical Services content.
 *
 * These are the nine service areas the business brief names for the Electrical
 * Services department, in the order the brief lists them.
 *
 * Content rule for this file: it describes what each discipline covers and how
 * work is scoped. It makes no claim the brief does not support — no licences,
 * certifications, standards compliance, client names, project counts, years of
 * trading, prices, guarantees or response times. Safety and compliance text is
 * deliberately about what is *assessed and agreed* rather than about
 * certificates held, because no certificate has been supplied. Anything of that
 * kind belongs in the CMS once the business supplies it, and would be false here.
 *
 * Where a technical term implies a standard (an earthing system, an inspection),
 * the text says the work is carried out and documented to the applicable
 * standard without naming a certification the business has not claimed.
 *
 * Local context is limited to verified national facts: Cameroon's grid supply,
 * its bilingual market and nationwide coverage.
 */

export const ELECTRICAL_SERVICES: readonly ServiceRecord[] = [
  {
    slug: "electrical-installation",
    department: "electrical-services",
    title: "Electrical Installation",
    summary:
      "Wiring, distribution boards, lighting and power circuits for new builds, fit-outs and upgrades, installed and documented.",
    description:
      "Electrical installation covers the fixed wiring and equipment that delivers power around a building: distribution boards, final circuits, sockets, lighting points, earthing and the protective devices that make a fault safe rather than dangerous.\n\nWe work on new construction, fit-outs and upgrades to existing installations. The first step is always a survey of what is there and what it will be asked to carry — the load the building actually imposes, not the load a previous occupant assumed. Where an existing installation is being extended, the assessment covers whether the supply, the distribution board and the protective devices can accept the additional demand before anything is added to them.\n\nInstallations are installed to the applicable wiring standard and handed over with documentation of what was installed: circuit schedules, the ratings of the protective devices, and the results of the tests carried out before energising. That record matters later, when someone needs to know which circuit feeds what.\n\nThe work is planned around how the building is used. A shop, an office, a workshop and a home impose different demands, and a circuit arrangement that suits one will not suit another. We agree the arrangement with you before installation begins, so the layout matches how the space is actually used.",
    features: [
      "Load assessment before any circuit is added to an existing installation",
      "Distribution boards, final circuits, sockets and lighting points",
      "Earthing and protective-device arrangements suited to the building",
      "Cable routing and containment planned around how the space is used",
      "New-build, fit-out and upgrade work",
      "Handover documentation: circuit schedules, device ratings and test results",
    ],
    faqs: [
      {
        question: "Can you add circuits to an existing installation?",
        answer:
          "Usually, but not before the existing supply and distribution board have been assessed. Adding load to an installation that was already at or near its capacity is how overloading begins. We check what the supply and the board can carry, and tell you if the answer is that something upstream needs to change first.",
      },
      {
        question: "What documentation do we receive at handover?",
        answer:
          "A record of what was installed and tested: the circuit schedule, the rating of each protective device, and the results of the tests carried out before the installation was energised. This is what allows a later fault to be traced to the right circuit without guesswork.",
      },
      {
        question: "Do you work on occupied buildings?",
        answer:
          "Yes. Work in an occupied building is planned in stages so that parts of the installation stay live and usable, and so that anything that must be isolated is isolated for a known period rather than left open-ended.",
      },
    ],
    deliveryNotes:
      "Delivered as a surveyed, staged project: assessment first, then an agreed scope and schedule, then installation and testing. In occupied buildings the programme is arranged around your operating hours so that isolation of a circuit happens at a time that suits the building.",
  },
  {
    slug: "solar-energy-systems",
    department: "electrical-services",
    title: "Solar Energy Systems",
    summary:
      "Solar generation, battery storage and hybrid supply designed around the load a site actually draws, including grid instability.",
    description:
      "A solar system is only as good as the load assessment behind it. Sizing by floor area or by a nominal figure produces a system that browns out under real demand, or one that was paid for and never used. We size against the load the site actually draws, measured where possible, and against how that load behaves through the day.\n\nThe design decisions follow from that assessment: how much generation is worth installing, how much battery capacity is justified, and whether the system should operate alongside the grid, as a backup for outages, or independently. In Cameroon the grid's stability varies by area, so the design has to account for how often the supply is interrupted and for how long, not just for the average consumption.\n\nBattery storage is the part most often sized badly. Capacity is matched to what you need to keep running through an outage — which circuits matter, and for how long — rather than to a round number. Where a site has a generator, the system is designed to work with it rather than to duplicate it.\n\nEvery system is commissioned and tested on site before handover, and the settings that govern how it behaves are documented so a future change does not have to be reverse-engineered.",
    features: [
      "Load assessment measured against real consumption, not a nominal figure",
      "Generation sizing for grid-tied, backup and off-grid arrangements",
      "Battery capacity matched to the circuits that must stay running",
      "Hybrid design that works with an existing generator rather than duplicating it",
      "Mounting, cabling, protection and earthing for the site's conditions",
      "Commissioning, on-site testing and documented system settings",
    ],
    faqs: [
      {
        question: "How do you decide how large a system should be?",
        answer:
          "From the load the site draws and how that load behaves through the day, measured where that is possible. Sizing from floor area or a nominal consumption figure is what produces systems that fail under real demand. We also ask how long an outage has to be covered, because that is what sets the battery capacity rather than the generation.",
      },
      {
        question: "Can a solar system work alongside a generator?",
        answer:
          "Yes, and where a site already has a generator that is usually the sensible arrangement. The generator covers heavy or prolonged demand and the solar and battery cover the routine load and shorter outages, which reduces how often the generator runs.",
      },
      {
        question: "Does the system need much maintenance?",
        answer:
          "Panels need cleaning and occasional inspection, and the battery and inverter settings are worth reviewing as the site's load changes. The maintenance schedule is agreed at handover and the settings are documented, so it does not depend on the installer being available to interpret them.",
      },
    ],
    deliveryNotes:
      "Delivered as survey, design, installation and commissioning. The system settings and the commissioning test results are handed over as a record, so the installation can be maintained and extended without having to reconstruct how it was configured.",
  },
  {
    slug: "maintenance-repairs",
    department: "electrical-services",
    title: "Maintenance & Repairs",
    summary:
      "Fault-finding, planned maintenance and repair work that restores the installation and identifies why it failed.",
    description:
      "Electrical faults are a symptom. A breaker that trips repeatedly, a circuit that overheats or a device that fails is telling you something about the installation, and replacing the part without understanding the cause is how the same fault returns.\n\nWe diagnose first: what failed, what the fault current did, and whether the cause is a defective component, an overloaded circuit, a loose connection or water ingress. The repair follows from that diagnosis, and where the fault is a symptom of an underlying problem — a circuit that was never sized for its load, say — we say so rather than repairing the same point again next month.\n\nPlanned maintenance is the other half of this work. Scheduled inspection of distribution boards, protective devices and connections catches the deterioration that leads to faults: heat at a loose terminal, a device that no longer trips at its rated current, insulation that has aged. A maintenance visit that finds those early is cheaper than the failure they would otherwise cause.\n\nBoth reactive and planned work are documented, so a site builds a history of what has failed and what has been done about it. That history is what turns maintenance from a recurring cost into a decision.",
    features: [
      "Fault diagnosis before repair, so the cause is identified and not just the symptom",
      "Repair of circuits, distribution boards, protective devices and equipment",
      "Planned maintenance visits with inspection of boards, devices and connections",
      "Thermal and continuity checks on connections and protective devices",
      "Identification of circuits that were never sized for their present load",
      "Documented history of faults found and work carried out",
    ],
    faqs: [
      {
        question: "Our breaker keeps tripping. What does that mean?",
        answer:
          "It means the protective device is doing its job — either the circuit is drawing more than it should, or there is a fault on it. Both need to be established before anything is changed. Replacing the device or repeatedly resetting it addresses neither cause and removes the protection that was preventing a worse outcome.",
      },
      {
        question: "How often should an installation be maintained?",
        answer:
          "It depends on the installation and how hard it is worked. A workshop running heavy machinery needs more frequent attention than an office. We agree a schedule from what the site contains and how it is used, and adjust it once there is a history of what the inspections actually find.",
      },
      {
        question: "Do you repair equipment as well as wiring?",
        answer:
          "We repair and replace fixed electrical equipment and the circuits serving it. Where a piece of equipment is beyond economic repair, we say so and quote the replacement rather than repeatedly patching it.",
      },
    ],
    deliveryNotes:
      "Available as reactive call-out or as an agreed maintenance schedule. Reactive work begins with diagnosis; planned work follows a schedule agreed from what the site contains. Either way the visit is documented, so the site accumulates a maintenance history rather than a series of disconnected repairs.",
  },
  {
    slug: "smart-home-automation",
    department: "electrical-services",
    title: "Smart Home Automation",
    summary:
      "Lighting, climate, access and monitoring control designed to keep working when the network or the internet does not.",
    description:
      "Home automation is electrical work with a control layer on top, and the control layer is where most installations disappoint. A system that depends entirely on a cloud service and a working internet connection stops working when either does — including the lights, which is precisely when you need them.\n\nThe design starts from what should be controllable and what should keep working regardless. Core lighting and access are arranged so they remain usable locally when the network is down, while scheduling, remote access and scenes use the network when it is available. That separation is a design decision, not an add-on, and it is why the control architecture is agreed before any device is chosen.\n\nWe work across the usual areas: lighting and scenes, climate and water heating, gate and door access, and monitoring such as cameras and sensors. Devices are selected to work together rather than as a collection of separate apps, and where a site already has equipment worth keeping, the design accommodates it instead of requiring everything to be replaced.\n\nAutomation is commissioned and demonstrated on site, and the configuration is documented, so a change later does not require the original installer to interpret it.",
    features: [
      "Control architecture designed so core lighting and access work without the internet",
      "Lighting scenes, scheduling and multi-way control",
      "Climate and water-heating control",
      "Gate, door and access control integration",
      "Camera and sensor monitoring integrated with the control system",
      "On-site commissioning, demonstration and documented configuration",
    ],
    faqs: [
      {
        question: "What happens to the lights when the internet goes down?",
        answer:
          "They keep working. Core lighting and access control are arranged to operate locally rather than through a cloud service, so a lost connection costs you remote access and scheduling, not the ability to turn on a light. This is a design decision made at the start, which is why we agree the control architecture before choosing devices.",
      },
      {
        question: "Can you work with equipment we already have?",
        answer:
          "Where it is worth keeping, yes. The design accommodates existing equipment rather than requiring the whole installation to be replaced, and we say plainly which existing devices will and will not integrate.",
      },
      {
        question: "Will we be able to change the settings ourselves?",
        answer:
          "Yes. The configuration is documented and the system is demonstrated at handover, so routine changes such as scenes and schedules can be made without the original installer. Structural changes to the control architecture are a separate piece of work.",
      },
    ],
    deliveryNotes:
      "Delivered as a designed installation rather than a device installation: control architecture first, then device selection, then commissioning. The configuration is documented and demonstrated on site, so the system can be adjusted later without depending on the original installer.",
  },
  {
    slug: "cctv-security",
    department: "electrical-services",
    title: "CCTV & Security",
    summary:
      "Camera, access and alarm systems planned around what needs to be seen, recorded and acted on.",
    description:
      "A security system is only useful if it answers the questions you will actually ask of it: who came in, what happened at that gate, and how long ago. That starts with coverage planning rather than with a camera count — deciding which approaches, boundaries and internal areas matter, and what has to be identifiable at each of them.\n\nFrom there the design follows: camera positions and types chosen for the light and distance at each location, recording capacity sized to how far back you need to look, and storage arranged so footage survives the loss of a single device. A camera placed for the wrong distance or in the wrong light produces footage that records an event without identifying it, which is the most common way a system fails.\n\nAccess control and alarms are planned with the cameras rather than separately, so that an entry event, a door held open and the recording of it are one system rather than three that have to be reconciled afterwards. Where a site has power interruptions, the system's own supply is designed to survive them, because a security system that goes down with the mains is absent exactly when it is needed.\n\nInstallation includes commissioning and a walk-through of the coverage, so what the system sees is demonstrated rather than assumed.",
    features: [
      "Coverage planning around the approaches and areas that matter",
      "Camera selection for the light and distance at each position",
      "Recording capacity sized to the retention period you need",
      "Storage arranged so footage survives the loss of one device",
      "Access control and alarm integration with the camera system",
      "Backup supply so the system outlasts a mains interruption",
    ],
    faqs: [
      {
        question: "How many cameras do we need?",
        answer:
          "That is the wrong first question, which is why we plan coverage before camera count. What matters is which approaches and areas need to be seen, and what has to be identifiable at each one. Once that is settled the number follows — and it is often lower than a camera-count-first plan, because positions are chosen for a purpose rather than to cover the plan evenly.",
      },
      {
        question: "How long is footage kept?",
        answer:
          "As long as you need it to be, which sets the recording capacity. We agree the retention period with you first, because storage sized without a target either runs out sooner than expected or is paid for and unused.",
      },
      {
        question: "What happens during a power cut?",
        answer:
          "The system is designed to keep running on its own supply through an interruption, because that is when it matters most. The backup duration is part of the design and is stated at handover rather than left to be discovered.",
      },
    ],
    deliveryNotes:
      "Delivered as coverage planning, installation, commissioning and a coverage walk-through. The retention period and the backup duration are agreed during design and demonstrated at handover, so what the system records and how long it keeps it are known rather than assumed.",
  },
  {
    slug: "equipment-supply-sales",
    department: "electrical-services",
    title: "Equipment Supply & Sales",
    summary:
      "Supply of electrical equipment, components and materials matched to the installation they will serve.",
    description:
      "Equipment supply sounds like a transaction and is better treated as part of the design. A protective device, a cable or a distribution board is chosen against the circuit it serves — its current, its environment and the fault level at that point. Supplying a component without that context is how installations end up with devices that do not coordinate, or with cable that was specified for a shorter run than the one installed.\n\nWe supply equipment for the installations we deliver and for installations others are delivering, matched to the specification rather than to what happens to be in stock. Where a specification calls for a particular rating or type, we say so and supply it, rather than substituting a near-equivalent and leaving the difference to be discovered during commissioning.\n\nAvailability matters, particularly for equipment that has to be ordered. Where a lead time affects your programme we tell you before you commit, rather than after, so the schedule can be planned around it. Where a substitute is genuinely equivalent we offer it as a choice with the difference explained, not as a silent swap.\n\nGenuine equipment is the point. Counterfeit and re-marked protective devices and cable are a real problem in the market and they fail in ways that are not obvious until a fault occurs. We supply equipment from established manufacturers through traceable channels.",
    features: [
      "Equipment matched to the circuit it serves, not to what is in stock",
      "Distribution boards, protective devices, cable, containment and accessories",
      "Specification held to the rating and type called for",
      "Lead times stated before you commit, not after",
      "Substitutes offered as an explained choice rather than a silent swap",
      "Equipment sourced from established manufacturers through traceable channels",
    ],
    faqs: [
      {
        question: "Can you supply equipment for an installation we are delivering ourselves?",
        answer:
          "Yes. We supply against a specification as readily as for our own installations. Send the schedule or the requirements and we will quote against it, and tell you where something specified is unavailable or where a genuine equivalent exists.",
      },
      {
        question: "Why does the exact rating of a protective device matter?",
        answer:
          "Because protective devices are chosen to coordinate with the circuit and with each other. A device of the wrong rating or type may fail to protect the cable it serves, or may trip before the device upstream of it should, which turns a fault on one circuit into a loss of supply to several.",
      },
      {
        question: "Do you supply cable by length?",
        answer:
          "Yes. Cable is supplied to the run it is needed for, and where the specification calls for a particular size we supply that size rather than the nearest available.",
      },
    ],
    deliveryNotes:
      "Supplied against a specification or a schedule, for our own installations and for those delivered by others. Lead times that affect a programme are stated before commitment, and any substitution is offered as an explained choice.",
  },
  {
    slug: "safety-inspections",
    department: "electrical-services",
    title: "Safety Inspections",
    summary:
      "Inspection and testing of an existing installation, with a written report of what was found and what needs attention.",
    description:
      "An inspection establishes what condition an installation is actually in. That is worth having before a purchase, before a change of use, before an insurer asks, and periodically for any installation that has been in service for years without one.\n\nThe work is a structured examination rather than a look around. It covers the intake and supply arrangements, the distribution boards and their protective devices, the condition of the wiring and its connections, earthing and bonding, and the tests that establish whether the protective devices operate as intended. Where something cannot be examined without disturbing the installation, the report says so rather than implying a completeness the inspection did not have.\n\nThe result is a written report: what was inspected, what was found, which findings are urgent and which can be planned, and what the applicable standard requires in each case. It distinguishes between a defect, a departure from the standard and a recommendation, because those carry different weight and are not the same thing.\n\nWe report on the installation we inspect. We do not issue certificates we are not entitled to issue, and where a formal certificate from another body is required we say so rather than substituting our report for it.",
    features: [
      "Structured inspection of intake, boards, circuits, earthing and bonding",
      "Testing of protective devices to establish that they operate as intended",
      "Written report separating defects, departures from standard and recommendations",
      "Findings marked as urgent or as work that can be planned",
      "Scope stated honestly where something could not be examined",
      "Suited to pre-purchase, change of use, insurance and periodic review",
    ],
    faqs: [
      {
        question: "What do we receive after an inspection?",
        answer:
          "A written report covering what was inspected, what was found, and what follows. Findings are separated into defects, departures from the applicable standard, and recommendations, and marked as urgent or as work that can be planned. The scope is stated honestly, including anything that could not be examined without disturbing the installation.",
      },
      {
        question: "Do you issue certificates?",
        answer:
          "We report on the installation we inspect. Where a formal certificate from a specific body is required for your purposes, we tell you that plainly rather than substituting our inspection report for it. We do not issue certificates we are not entitled to issue.",
      },
      {
        question: "When is an inspection worth doing?",
        answer:
          "Before buying a property, before changing how a building is used, when an insurer or a landlord asks for one, and periodically for any installation that has been in service for years without one. An inspection is also the sensible first step before extending an installation, because it establishes what the existing work can support.",
      },
    ],
    deliveryNotes:
      "Delivered as an inspection visit followed by a written report. The report is the deliverable, and it is written so that someone other than the inspector can act on it — findings are separated by type and by urgency rather than presented as a single list.",
  },
  {
    slug: "industrial-project-contracting",
    department: "electrical-services",
    title: "Industrial Project Contracting",
    summary:
      "Electrical scope on industrial projects, from design and specification through installation, testing and handover.",
    description:
      "Industrial electrical work is a project discipline. It involves the supply and distribution arrangements for machinery and process equipment, the control and protection of motors and drives, the containment and cabling that carries power and control around a plant, and the documentation that lets the installation be operated and maintained afterwards.\n\nWe take the electrical scope as a whole rather than as a set of separate jobs: design and specification, supply of the equipment, installation, testing and handover. Working that way is what keeps the parts consistent with each other — a protective device coordination study, for instance, is meaningless if the devices are then supplied and installed against a different arrangement than the one studied.\n\nProjects are programmed in stages with the electrical work sequenced against the wider build. Where electrical work depends on equipment arriving or on civils being complete, that dependency is stated in the programme rather than discovered when the electricians arrive on site and the floor is not ready.\n\nHandover is documentation: as-built drawings reflecting what was actually installed rather than what was designed, circuit and panel schedules, device settings, and test results. On an industrial installation that record is not a formality — it is what makes the plant maintainable by someone other than the original contractor.",
    features: [
      "Whole electrical scope: design, specification, supply, installation, testing",
      "Supply and distribution arrangements for machinery and process equipment",
      "Motor and drive control, protection and coordination",
      "Containment and cabling for power and control circuits",
      "Programming staged against the wider build, with dependencies stated",
      "As-built drawings, schedules, device settings and test results at handover",
    ],
    faqs: [
      {
        question: "Do you take the whole electrical scope or individual jobs?",
        answer:
          "We prefer the whole scope, because the parts of an industrial installation constrain each other. A protective-device coordination study is worthless if the devices are then supplied and installed against a different arrangement. Taking the scope as a whole is what keeps design, supply and installation consistent.",
      },
      {
        question: "What do we receive at handover?",
        answer:
          "As-built drawings reflecting what was installed rather than what was designed, circuit and panel schedules, the settings of the protective and control devices, and the results of the tests carried out. On an industrial plant that record is what makes the installation maintainable by someone other than the contractor who built it.",
      },
      {
        question: "Can you work alongside other contractors?",
        answer:
          "Yes, and on a plant it is usually unavoidable. The electrical programme is sequenced against the wider build, and where electrical work depends on equipment arriving or on civils being finished, that dependency is stated in the programme rather than discovered on site.",
      },
    ],
    deliveryNotes:
      "Delivered as a contracted electrical scope within a wider project, programmed in stages with dependencies on other trades stated up front. Handover includes as-built documentation, device settings and test results.",
  },
  {
    slug: "low-medium-voltage-line-design-construction",
    department: "electrical-services",
    title: "Low/Medium Voltage Line Design & Construction",
    summary:
      "Design and construction of low and medium voltage distribution lines, including survey, poles, conductors and protection.",
    description:
      "Overhead and underground distribution lines carry power between a source and the point of use, and their design is governed by the route as much as by the load. A line's span, its clearances, the conductor it uses and the protection at each end all follow from where it runs and what it has to cross.\n\nThe work begins with a route survey: the path the line will take, what it passes over and under, where it can be supported, and where access for construction and later maintenance is possible. That survey determines the structure — pole positions and heights, span lengths, conductor selection and the clearances that must be maintained — and it is why a line designed without one is usually redesigned during construction.\n\nFrom there we construct: poles or trenching, conductors or cable, terminations, and the switchgear and protection that make the line safe to operate and possible to isolate. Voltage drop over the length of the run is calculated rather than assumed, because a line that delivers an acceptable voltage at its source and an unacceptable one at its far end has not been designed for its actual purpose.\n\nConstruction is followed by testing and energisation, and by documentation of what was built: the route as constructed, the conductor and equipment ratings, and the test results. Lines are built to the applicable standard for their voltage class, and the clearances and protection arrangements are designed to it.",
    features: [
      "Route survey covering crossings, clearances and access for maintenance",
      "Structure design: pole positions, heights, spans and conductor selection",
      "Voltage-drop calculation across the full length of the run",
      "Construction of overhead and underground low and medium voltage lines",
      "Terminations, switchgear and protection arrangements",
      "Testing, energisation and as-built documentation",
    ],
    faqs: [
      {
        question: "Why does a route survey come first?",
        answer:
          "Because the route determines the design. Span lengths, clearances, conductor selection and where the line can be supported all follow from the path it takes and what it crosses. A line designed without a survey is usually redesigned during construction, which is more expensive than surveying it first.",
      },
      {
        question: "How is voltage drop handled on a long line?",
        answer:
          "It is calculated across the full length of the run rather than assumed from the source voltage. A line can deliver an acceptable voltage at its source and an unacceptable one at its far end, which is a design failure that only becomes visible once the line is in service.",
      },
      {
        question: "What documentation is provided for a completed line?",
        answer:
          "The route as actually constructed, the ratings of the conductors and the installed equipment, the protection arrangements, and the results of the tests carried out before energisation. This is what a future fault or extension has to be worked from.",
      },
    ],
    deliveryNotes:
      "Delivered as survey, design, construction and energisation. The route survey and the voltage-drop calculation are done before construction rather than during it, and the completed line is handed over with as-built documentation and test results.",
  },
];
