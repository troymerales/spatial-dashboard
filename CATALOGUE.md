# Indicator catalogue

> **Auto-generated — do not edit by hand.**
> `node scripts/gen-catalogue.mjs` rebuilds this from `src/data/indicators.ts`,
> `src/data/facilities.ts`, `src/data/synth.ts` and `src/state.ts`.

**Every health figure described here is synthetic**, generated in the browser from seed `20260916`. Only the geography (boundaries, land area, centroids) is real. Nothing in this document should be read as a statement about health in the Philippines.

## At a glance

| | |
|---|---|
| Categories | 10 |
| Indicators | 62 |
| Mappable | 58 |
| Deliberately not mapped | 4 |
| Count-based (get suppression + reliability flags) | 39 |
| Population bases | 7 |
| Facility types | 7 |
| Periods | 156 weeks (W01 2023 – W52 2025) |
| Default disclosure threshold | 10 cases |

## Contents

- [Service utilisation](#service-utilisation) — 7 indicators
- [Maternal & child health](#maternal--child-health) — 8 indicators
- [Immunisation](#immunisation) — 5 indicators
- [Communicable disease](#communicable-disease) — 8 indicators
- [Non-communicable disease](#non-communicable-disease) — 7 indicators
- [Nutrition](#nutrition) — 5 indicators
- [Workforce & facilities](#workforce--facilities) — 9 indicators
- [Water, sanitation & environment](#water-sanitation--environment) — 4 indicators
- [Coverage & financing](#coverage--financing) — 4 indicators
- [Demographic context](#demographic-context) — 5 indicators
- [Population bases](#population-bases)
- [Facility types](#facility-types)
- [Analysis views](#analysis-views)
- [Indicators excluded from mapping](#indicators-excluded-from-mapping)

---

## Indicator categories

### Service utilisation

_How much care is actually being delivered, relative to the population served._

`utilization` · 7 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Outpatient consultations per 1,000 population**<br><sub>`util_outpatient_rate`</sub> | per 1,000 | Total population | neither | yes |
| **Outpatient consultations (total count)**<br><sub>`util_outpatient_count`</sub> | count | — | neither | **no** |
| **Share of consultations that are first visits**<br><sub>`util_first_visit_share`</sub> | % | — | neither | yes |
| **Referrals to a higher-level facility per 1,000 population**<br><sub>`util_referral_rate`</sub> | per 1,000 | Total population | neither | yes |
| **Emergency presentations per 1,000 population**<br><sub>`util_er_rate`</sub> | per 1,000 | Total population | higher is worse | yes |
| **Teleconsultation share of consultations**<br><sub>`util_teleconsult_share`</sub> | % | — | neither | yes |
| **Follow-up appointments kept**<br><sub>`util_followup_adherence`</sub> | % | — | higher is better | yes |

- **Outpatient consultations per 1,000 population** — Primary-care outpatient consultations recorded in the period, per 1,000 residents. Neither high nor low is automatically good: high can mean good access or high morbidity, low can mean a healthy population or an unreachable one.
- **Outpatient consultations (total count)** — Unadjusted number of outpatient consultations recorded in the period.
  - _Caveat:_ A choropleth of a raw count is a population map wearing a lab coat: the biggest LGUs always shade darkest. Use the per-1,000 rate for the map and read counts in the table when you need workload volume.
- **Share of consultations that are first visits** — Proportion of consultations that are a new episode rather than a follow-up. A very high share can indicate weak continuity of care.
- **Referrals to a higher-level facility per 1,000 population** — Onward referrals to a higher-level facility per 1,000 residents. Very low rates in remote LGUs often mean referral is impractical, not that patients are well.
- **Emergency presentations per 1,000 population** — Emergency department presentations per 1,000 residents. Elevated rates alongside low outpatient rates can indicate primary care is not absorbing demand.
- **Teleconsultation share of consultations** — Proportion of consultations delivered remotely.
- **Follow-up appointments kept** — Proportion of scheduled follow-up appointments attended.

### Maternal & child health

_Antenatal, delivery and postpartum care coverage and outcomes._

`maternal_child` · 8 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Antenatal care, 4+ visits**<br><sub>`mch_anc4`</sub> | % | Live births | higher is better | yes |
| **Facility-based deliveries**<br><sub>`mch_facility_birth`</sub> | % | Live births | higher is better | yes |
| **Births attended by a skilled provider**<br><sub>`mch_skilled_attendant`</sub> | % | Live births | higher is better | yes |
| **Postpartum visit within 72 hours**<br><sub>`mch_postpartum`</sub> | % | Live births | higher is better | yes |
| **Adolescent birth rate (15–19)**<br><sub>`mch_teen_birth`</sub> | per 1,000 | Women 15–49 | higher is worse | yes |
| **Low birth weight**<br><sub>`mch_lbw`</sub> | % | Live births | higher is worse | yes |
| **Modern contraceptive prevalence**<br><sub>`mch_family_planning`</sub> | % | Women 15–49 | higher is better | yes |
| **Maternal deaths (count)**<br><sub>`mch_maternal_deaths`</sub> | count | — | higher is worse | **no** |

- **Antenatal care, 4+ visits** — Share of pregnancies with at least four antenatal visits.
- **Facility-based deliveries** — Share of live births delivered in a health facility.
- **Births attended by a skilled provider** — Share of live births attended by a doctor, nurse or midwife.
- **Postpartum visit within 72 hours** — Share of mothers seen within three days of delivery.
- **Adolescent birth rate (15–19)** — Births to women aged 15–19 per 1,000 women of reproductive age.
- **Low birth weight** — Share of live births under 2,500 g.
- **Modern contraceptive prevalence** — Share of women 15–49 using a modern family planning method.
- **Maternal deaths (count)** — Deaths from maternal causes recorded in the period.
  - _Caveat:_ Maternal deaths are rare events. At municipal level most LGUs record 0–2 per year, so a map shows noise, not risk — and a single death in a small barangay can be individually identifiable. Review as a province-level trend with confidence intervals instead.

### Immunisation

_Routine childhood vaccination coverage and dropout._

`immunization` · 5 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Fully immunised children**<br><sub>`imm_fic`</sub> | % | Children under 5 | higher is better | yes |
| **Measles-containing vaccine, 2nd dose**<br><sub>`imm_measles`</sub> | % | Children under 5 | higher is better | yes |
| **Pentavalent 3rd dose coverage**<br><sub>`imm_penta3`</sub> | % | Children under 5 | higher is better | yes |
| **Penta1-to-Penta3 dropout**<br><sub>`imm_dropout`</sub> | % | — | higher is worse | yes |
| **Zero-dose children**<br><sub>`imm_zero_dose`</sub> | % | Children under 5 | higher is worse | yes |

- **Fully immunised children** — Share of children completing the routine schedule before their first birthday.
- **Measles-containing vaccine, 2nd dose** — Share of children receiving the second measles dose. Sustained coverage below 95% permits outbreaks.
- **Pentavalent 3rd dose coverage** — Share of infants receiving three doses of pentavalent vaccine.
- **Penta1-to-Penta3 dropout** — Share of infants who start but do not complete the pentavalent series. Isolates follow-through from initial reach, which is the actionable part.
- **Zero-dose children** — Share of children who have received no routine vaccine at all — the clearest marker of populations the system is not reaching.

### Communicable disease

_Notifiable and endemic infectious disease burden._

`communicable` · 8 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **TB case notification rate**<br><sub>`com_tb_notification`</sub> | per 100,000 | Total population | neither | yes |
| **TB treatment success rate**<br><sub>`com_tb_success`</sub> | % | — | higher is better | yes |
| **Dengue incidence**<br><sub>`com_dengue`</sub> | per 100,000 | Total population | higher is worse | yes |
| **Acute respiratory infection, under 5**<br><sub>`com_ari_under5`</sub> | per 1,000 | Children under 5 | higher is worse | yes |
| **Diarrhoeal disease, under 5**<br><sub>`com_diarrhea_under5`</sub> | per 1,000 | Children under 5 | higher is worse | yes |
| **Leptospirosis incidence**<br><sub>`com_leptospirosis`</sub> | per 100,000 | Total population | higher is worse | yes |
| **HIV testing uptake, adults**<br><sub>`com_hiv_testing`</sub> | per 1,000 | Population 15+ | higher is better | yes |
| **HIV prevalence, adults**<br><sub>`com_hiv_prevalence`</sub> | % | Population 15+ | higher is worse | **no** |

- **TB case notification rate** — Tuberculosis cases notified per 100,000 residents. Reads as burden *and* as detection effort — a low rate may mean good control or poor case-finding.
- **TB treatment success rate** — Share of notified TB cases cured or completing treatment.
- **Dengue incidence** — Reported dengue cases per 100,000 residents.
- **Acute respiratory infection, under 5** — Acute respiratory infection episodes per 1,000 children under five.
- **Diarrhoeal disease, under 5** — Diarrhoeal episodes per 1,000 children under five. Tracks closely with water and sanitation access.
- **Leptospirosis incidence** — Reported leptospirosis cases per 100,000 residents. Strongly seasonal and flood-driven.
- **HIV testing uptake, adults** — HIV tests performed per 1,000 adults.
- **HIV prevalence, adults** — Estimated share of adults living with HIV.
  - _Caveat:_ Excluded from mapping at municipal level. Case counts are small enough that a shaded polygon plus a facility roster can re-identify individuals, and stigma makes that harm severe and irreversible. Available as a province-level aggregate on request.

### Non-communicable disease

_Chronic conditions detected and managed through the primary care network._

`ncd` · 7 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Hypertension prevalence, adults**<br><sub>`ncd_hypertension_prev`</sub> | % | Population 15+ | higher is worse | yes |
| **Hypertension controlled on treatment**<br><sub>`ncd_hypertension_control`</sub> | % | — | higher is better | yes |
| **Diabetes prevalence, adults**<br><sub>`ncd_diabetes_prev`</sub> | % | Population 15+ | higher is worse | yes |
| **Adults screened for hypertension or diabetes**<br><sub>`ncd_screening_coverage`</sub> | % | Population 15+ | higher is better | yes |
| **Cardiovascular admissions per 10,000**<br><sub>`ncd_cvd_admission`</sub> | per 10,000 | Total population | higher is worse | yes |
| **Chronic respiratory consultations per 1,000**<br><sub>`ncd_copd_asthma`</sub> | per 1,000 | Total population | higher is worse | yes |
| **Mental health service contacts per 1,000**<br><sub>`ncd_mental_health_contact`</sub> | per 1,000 | Total population | neither | yes |

- **Hypertension prevalence, adults** — Share of adults with diagnosed hypertension. Depends heavily on screening intensity — compare against the screening coverage indicator before concluding anything about true burden.
- **Hypertension controlled on treatment** — Share of enrolled hypertensive patients whose most recent reading is at target.
- **Diabetes prevalence, adults** — Share of adults with diagnosed diabetes.
- **Adults screened for hypertension or diabetes** — Share of adults screened in the period. The essential companion to any prevalence map: low prevalence with low screening means unknown, not healthy.
- **Cardiovascular admissions per 10,000** — Inpatient admissions for cardiovascular causes per 10,000 residents.
- **Chronic respiratory consultations per 1,000** — Consultations for COPD or asthma per 1,000 residents.
- **Mental health service contacts per 1,000** — Contacts with a mental health service per 1,000 residents. In most LGUs this measures service availability far more than it measures need.

### Nutrition

_Child growth monitoring and nutritional status._

`nutrition` · 5 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Stunting, under 5**<br><sub>`nut_stunting`</sub> | % | Children under 5 | higher is worse | yes |
| **Wasting, under 5**<br><sub>`nut_wasting`</sub> | % | Children under 5 | higher is worse | yes |
| **Overweight, under 5**<br><sub>`nut_overweight_child`</sub> | % | Children under 5 | higher is worse | yes |
| **Exclusive breastfeeding to 6 months**<br><sub>`nut_exclusive_bf`</sub> | % | — | higher is better | yes |
| **Vitamin A supplementation, 6–59 months**<br><sub>`nut_vitamin_a`</sub> | % | Children under 5 | higher is better | yes |

- **Stunting, under 5** — Share of children under five below −2 SD height-for-age.
- **Wasting, under 5** — Share of children under five below −2 SD weight-for-height. Responds faster than stunting, so it is the better early-warning signal.
- **Overweight, under 5** — Share of children under five above +2 SD weight-for-height.
- **Exclusive breastfeeding to 6 months** — Share of infants exclusively breastfed through six months.
- **Vitamin A supplementation, 6–59 months** — Share of children 6–59 months receiving supplementation in the period.

### Workforce & facilities

_Supply side: staff, facilities and beds available to the population._

`workforce` · 9 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Health facilities per 10,000 population**<br><sub>`wf_facilities_per_10k`</sub> | per 10,000 | Total population | higher is better | yes |
| **Physicians per 10,000 population**<br><sub>`wf_doctors_per_10k`</sub> | per 10,000 | Total population | higher is better | yes |
| **Nurses per 10,000 population**<br><sub>`wf_nurses_per_10k`</sub> | per 10,000 | Total population | higher is better | yes |
| **Midwives per 10,000 population**<br><sub>`wf_midwives_per_10k`</sub> | per 10,000 | Total population | higher is better | yes |
| **Barangay health workers per 1,000 population**<br><sub>`wf_bhw_per_1000`</sub> | per 1,000 | Total population | higher is better | yes |
| **Hospital beds per 10,000 population**<br><sub>`wf_beds_per_10k`</sub> | per 10,000 | Total population | higher is better | yes |
| **Funded health posts vacant**<br><sub>`wf_vacancy_rate`</sub> | % | — | higher is worse | yes |
| **Straight-line distance to nearest facility**<br><sub>`acc_nearest_facility_km`</sub> | km | — | higher is worse | yes |
| **Straight-line distance to nearest inpatient facility**<br><sub>`acc_nearest_inpatient_km`</sub> | km | — | higher is worse | yes |

- **Health facilities per 10,000 population** — Facilities of any type per 10,000 residents. Computed from the facility register rather than generated, so it is consistent with the Access view.
- **Physicians per 10,000 population** — Physicians in public service per 10,000 residents.
- **Nurses per 10,000 population** — Nurses in public service per 10,000 residents.
- **Midwives per 10,000 population** — Midwives assigned per 10,000 residents.
- **Barangay health workers per 1,000 population** — Accredited barangay health workers per 1,000 residents.
- **Hospital beds per 10,000 population** — Licensed inpatient beds per 10,000 residents, attributed to the LGU that hosts the facility — not to the catchment it actually serves.
  - _Caveat:_ Beds are attributed to the host LGU. A municipality with the district hospital will look extremely well supplied and its neighbours extremely poorly supplied, when in practice they share one facility. Read this alongside the Access view.
- **Funded health posts vacant** — Share of funded health positions unfilled at period end.
- **Straight-line distance to nearest facility** — Great-circle distance from the LGU centroid to the nearest facility of any type, which may sit in a neighbouring LGU. Computed from geometry, not generated.
  - _Caveat:_ Straight-line distance, not travel time. It ignores roads, terrain, rivers and sea crossings, so it flatters island and mountain LGUs. Travel-time isochrones need a routing network we do not have yet.
- **Straight-line distance to nearest inpatient facility** — Great-circle distance from the LGU centroid to the nearest facility with inpatient capability. Computed from geometry.
  - _Caveat:_ Straight-line distance, not travel time. Sea crossings between islands are counted as short hops when in practice they can take hours.

### Water, sanitation & environment

_Environmental determinants that drive downstream health demand._

`wash` · 4 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Households with basic safe water**<br><sub>`wash_safe_water`</sub> | % | Households | higher is better | yes |
| **Households with basic sanitation**<br><sub>`wash_sanitation`</sub> | % | Households | higher is better | yes |
| **Open defecation**<br><sub>`wash_open_defecation`</sub> | % | Households | higher is worse | yes |
| **Households with regular waste collection**<br><sub>`wash_waste_collection`</sub> | % | Households | higher is better | yes |

- **Households with basic safe water** — Share of households with a basic improved drinking water source.
- **Households with basic sanitation** — Share of households with an improved, non-shared toilet facility.
- **Open defecation** — Share of households practising open defecation.
- **Households with regular waste collection** — Share of households served by scheduled solid waste collection.

### Coverage & financing

_Insurance enrolment and out-of-pocket exposure._

`financing` · 4 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Population with active health insurance**<br><sub>`fin_insurance_coverage`</sub> | % | Total population | higher is better | yes |
| **Insurance claims per 1,000 members**<br><sub>`fin_claims_per_1000`</sub> | per 1,000 | Total population | neither | yes |
| **Out-of-pocket share of health spending**<br><sub>`fin_oop_share`</sub> | % | — | higher is worse | yes |
| **LGU health budget per capita**<br><sub>`fin_budget_per_capita`</sub> | ratio | Total population | higher is better | yes |

- **Population with active health insurance** — Share of residents with active national health insurance membership.
- **Insurance claims per 1,000 members** — Claims filed per 1,000 covered residents. Low claiming in a covered population usually signals a supply or awareness problem, not good health.
- **Out-of-pocket share of health spending** — Share of household health expenditure paid directly at point of care.
- **LGU health budget per capita** — Appropriated LGU health budget divided by population, in pesos.

### Demographic context

_Population structure. Context for every other indicator, rarely a target in itself._

`demography` · 5 indicators

| Indicator | Unit | Denominator | Direction | Mapped |
|---|---|---|---|---|
| **Total population**<br><sub>`dem_population`</sub> | count | — | neither | **no** |
| **Population density**<br><sub>`dem_pop_density`</sub> | per km² | — | neither | yes |
| **Population under 5**<br><sub>`dem_under5_share`</sub> | % | Total population | neither | yes |
| **Population 60 and over**<br><sub>`dem_over60_share`</sub> | % | Total population | neither | yes |
| **Age dependency ratio**<br><sub>`dem_dependency_ratio`</sub> | ratio | — | neither | yes |

- **Total population** — Synthetic mid-year resident population.
  - _Caveat:_ Population shaded by polygon is the classic misleading choropleth — area, not people, drives the colour. The Access view renders population as proportional circles instead, which is the honest encoding for a count.
- **Population density** — Residents per km² of land area. Land area is real, from the boundary source; population is synthetic.
- **Population under 5** — Share of residents under five years old.
- **Population 60 and over** — Share of residents aged 60 or older. Drives NCD and long-term care demand.
- **Age dependency ratio** — Dependants (under 15 plus 65 and over) per 100 working-age residents.

---

## Population bases

Denominators available to rates. All synthetic.

| Base | `id` | Notes |
|---|---|---|
| Total population | `population` | All residents, synthetic mid-year estimate. |
| Women 15–49 | `women_15_49` | Reproductive-age women. |
| Children under 5 | `children_under_5` | Children aged 0–59 months. |
| Live births | `live_births` | Births registered in the period. |
| Households | `households` | Occupied housing units. |
| Population 15+ | `pop_15_plus` | Adults, the base for most NCD screening. |
| Population 60+ | `pop_60_plus` | Older persons. |

---

## Facility types

Synthetic register. Positions are drawn by rejection sampling inside each area’s real polygon. "Inpatient" types are the ones the nearest-inpatient access metric searches.

| Type | `id` | Inpatient |
|---|---|---|
| Barangay health station | `bhs` | no |
| Rural health unit / city health centre | `rhu` | no |
| Birthing home | `birthing` | no |
| Private clinic | `private_clinic` | no |
| Infirmary | `infirmary` | yes |
| District hospital | `district_hospital` | yes |
| Provincial / city hospital | `provincial_hospital` | yes |

---

## Analysis views

| View | Question it answers |
|---|---|
| **Explore** (`explore`) | How does one indicator vary across the country, and which areas stand out? |
| **Compare** (`compare`) | Where do two problems land in the same place? |
| **Screen** (`screen`) | Which areas cross thresholds I set myself? |
| **Access** (`access`) | Which populations are physically far from care? |

---

## Indicators excluded from mapping

A field existing at LGU level is not a reason to paint it on a choropleth. Selecting one of these replaces the map with the explanation below; the ranked table still shows every value.

### Outpatient consultations (total count)

`util_outpatient_count` · Service utilisation

A choropleth of a raw count is a population map wearing a lab coat: the biggest LGUs always shade darkest. Use the per-1,000 rate for the map and read counts in the table when you need workload volume.

### Maternal deaths (count)

`mch_maternal_deaths` · Maternal & child health

Maternal deaths are rare events. At municipal level most LGUs record 0–2 per year, so a map shows noise, not risk — and a single death in a small barangay can be individually identifiable. Review as a province-level trend with confidence intervals instead.

### HIV prevalence, adults

`com_hiv_prevalence` · Communicable disease

Excluded from mapping at municipal level. Case counts are small enough that a shaded polygon plus a facility roster can re-identify individuals, and stigma makes that harm severe and irreversible. Available as a province-level aggregate on request.

### Total population

`dem_population` · Demographic context

Population shaded by polygon is the classic misleading choropleth — area, not people, drives the colour. The Access view renders population as proportional circles instead, which is the honest encoding for a count.
