import { SegmentedControl } from "@riichimi/ui";
import { fuCatalog, groupFuCatalog, yakuCatalog, yakumanCatalog } from "@riichimi/score-core";
import type { ScoringRules, YakuReference, YakumanReference } from "@riichimi/score-core";
import { scoringRulesProfiles } from "@riichimi/rules";
import { useId, useState } from "react";

import { houseRulesProfileId, houseScoringRules } from "../features/rules/house-rules";
import { useLocale } from "../state/locale-context";
import { useRules } from "../state/rules-context";
import styles from "./reference-screen.module.css";

type Chapter = "yaku" | "fu" | "rulesets";

/** Han bands, in the order a player asks about them. Yakuman is its own band. */
const BANDS = [1, 2, 3, 5, 6] as const;

function matches(entry: YakuReference | YakumanReference, query: string): boolean {
  // Trimmed: a trailing space is the most ordinary thing to type after a word,
  // and matching it literally emptied the whole reference.
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return true;
  }
  return [entry.japanese, entry.name, entry.romanized, entry.requirement].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

type Translate = (source: string, values?: Readonly<Record<string, string>>) => string;

function hanLabel(entry: YakuReference, t: Translate): string {
  if (entry.openHan === null) {
    return t("closed only");
  }
  return entry.openHan === entry.closedHan ? "" : t("{han} open", { han: String(entry.openHan) });
}

export function ReferenceScreen() {
  const { t } = useLocale();
  const rules = useRules();
  const [chapter, setChapter] = useState<Chapter>("yaku");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const chapterId = useId();

  // The player's own house profile belongs beside the published ones: it is a
  // ruleset this app will actually score by.
  const profiles: readonly ScoringRules[] = [
    ...scoringRulesProfiles,
    houseScoringRules(rules.houseRules),
  ];
  const yaku = yakuCatalog.filter((entry) => matches(entry, query));
  const yakuman = yakumanCatalog.filter((entry) => matches(entry, query));

  return (
    <div className={styles["screen"]}>
      <div className={styles["scroll"]}>
        <div className={styles["content"]}>
          <div className={styles["header"]}>
            <p className={styles["kicker"]}>{t("REFERENCE")}</p>
            <h1 className={styles["title"]}>{t("Yaku, fu, and rulesets")}</h1>
            <p className={styles["intro"]}>
              {t(
                "The same table the scorer works from. A yaku listed here is one this app can award, worth exactly what it says.",
              )}
            </p>
          </div>

          <div className={styles["controls"]}>
            <div className={styles["field"]}>
              <p className={styles["fieldLabel"]} id={chapterId}>
                {t("SECTION")}
              </p>
              <SegmentedControl
                labelledBy={chapterId}
                onChange={setChapter}
                options={[
                  { label: t("Yaku"), value: "yaku" },
                  { label: t("Fu"), value: "fu" },
                  { label: t("Rulesets"), value: "rulesets" },
                ]}
                value={chapter}
              />
            </div>
            {chapter === "yaku" ? (
              <div className={styles["field"]}>
                <label className={styles["fieldLabel"]} htmlFor={searchId}>
                  {t("FIND A YAKU")}
                </label>
                <input
                  className={styles["search"]}
                  id={searchId}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("Name, reading, or what it needs")}
                  type="search"
                  value={query}
                />
              </div>
            ) : null}
          </div>

          {chapter === "yaku" ? (
            <>
              {BANDS.map((han) => {
                const band = yaku.filter((entry) => entry.closedHan === han);
                if (band.length === 0) {
                  return null;
                }
                return (
                  <section className={styles["band"]} key={han}>
                    <h2 className={styles["bandTitle"]}>{t("{han} han", { han: String(han) })}</h2>
                    <div className={styles["rows"]}>
                      {band.map((entry) => (
                        <article className={styles["row"]} key={entry.id}>
                          <p className={styles["japanese"]}>{entry.japanese}</p>
                          <div className={styles["rowBody"]}>
                            <p className={styles["name"]}>{entry.name}</p>
                            <p className={styles["romanized"]}>{entry.romanized}</p>
                            <p className={styles["requirement"]}>{t(entry.requirement)}</p>
                          </div>
                          <p className={styles["value"]}>{hanLabel(entry, t)}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}

              {yakuman.length === 0 ? null : (
                <section className={styles["band"]}>
                  <h2 className={styles["bandTitle"]}>{t("Yakuman")}</h2>
                  <div className={styles["rows"]}>
                    {yakuman.map((entry) => (
                      <article className={styles["row"]} key={entry.id}>
                        <p className={styles["japanese"]}>{entry.japanese}</p>
                        <div className={styles["rowBody"]}>
                          <p className={styles["name"]}>{entry.name}</p>
                          <p className={styles["romanized"]}>{entry.romanized}</p>
                          <p className={styles["requirement"]}>{t(entry.requirement)}</p>
                        </div>
                        <p className={styles["value"]}>
                          {entry.doubleWhen === null
                            ? ""
                            : t("double: {when}", {
                                when: t(entry.doubleWhen),
                              })}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {yaku.length === 0 && yakuman.length === 0 ? (
                <p className={styles["empty"]}>{t("Nothing matches that.")}</p>
              ) : null}
            </>
          ) : null}

          {chapter === "fu" ? (
            <>
              <section className={styles["band"]}>
                <h2 className={styles["bandTitle"]}>{t("The hand itself")}</h2>
                <div className={styles["rows"]}>
                  {fuCatalog.map((entry) => (
                    <article className={styles["row"]} key={entry.reason}>
                      <p className={styles["fuValue"]}>
                        {entry.fu === null ? t("2 or 4") : `+${String(entry.fu)}`}
                      </p>
                      <div className={styles["rowBody"]}>
                        <p className={styles["name"]}>{t(entry.reason)}</p>
                        <p className={styles["requirement"]}>{t(entry.note)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles["band"]}>
                <h2 className={styles["bandTitle"]}>{t("Triplets and quads")}</h2>
                <div className={styles["rows"]}>
                  {groupFuCatalog.map((entry) => (
                    <article className={styles["row"]} key={entry.reason}>
                      <p className={styles["fuValue"]}>+{entry.fu}</p>
                      <div className={styles["rowBody"]}>
                        <p className={styles["name"]}>{t(entry.reason)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <p className={styles["footnote"]}>
                {t("The total is rounded up to the next ten before the score is worked out.")}
              </p>
            </>
          ) : null}

          {chapter === "rulesets" ? (
            <section className={styles["band"]}>
              <h2 className={styles["bandTitle"]}>{t("What each profile decides")}</h2>
              <div className={styles["rows"]}>
                {profiles.map((profile) => (
                  <article className={styles["profile"]} key={profile.id}>
                    <div className={styles["profileHead"]}>
                      <h3 className={styles["name"]}>{profile.label}</h3>
                      {profile.id === rules.activeRules.id ? (
                        <p className={styles["activeTag"]}>{t("IN USE")}</p>
                      ) : null}
                    </div>
                    <dl className={styles["differences"]}>
                      <div className={styles["difference"]}>
                        <dt className={styles["differenceTerm"]}>{t("Red fives")}</dt>
                        <dd className={styles["differenceValue"]}>
                          {profile.redFives ? t("yes") : t("no")}
                        </dd>
                      </div>
                      <div className={styles["difference"]}>
                        <dt className={styles["differenceTerm"]}>{t("Open tanyao")}</dt>
                        <dd className={styles["differenceValue"]}>
                          {profile.allowOpenTanyao ? t("yes") : t("no")}
                        </dd>
                      </div>
                      <div className={styles["difference"]}>
                        <dt className={styles["differenceTerm"]}>{t("Round-up mangan")}</dt>
                        <dd className={styles["differenceValue"]}>
                          {profile.kiriageMangan ? t("yes") : t("no")}
                        </dd>
                      </div>
                      <div className={styles["difference"]}>
                        <dt className={styles["differenceTerm"]}>{t("13+ han")}</dt>
                        <dd className={styles["differenceValue"]}>
                          {profile.countedLimit === "yonbaiman"
                            ? t("kazoe yakuman")
                            : t("capped at sanbaiman")}
                        </dd>
                      </div>
                      <div className={styles["difference"]}>
                        <dt className={styles["differenceTerm"]}>{t("Ura-dora")}</dt>
                        <dd className={styles["differenceValue"]}>
                          {profile.uraDora ? t("yes") : t("no")}
                        </dd>
                      </div>
                      <div className={styles["difference"]}>
                        <dt className={styles["differenceTerm"]}>{t("Combined yakuman")}</dt>
                        <dd className={styles["differenceValue"]}>
                          {profile.yakumanStacking === "additive"
                            ? t("add up")
                            : t("never combine")}
                        </dd>
                      </div>
                      <div className={styles["difference"]}>
                        <dt className={styles["differenceTerm"]}>{t("Double wind pair")}</dt>
                        <dd className={styles["differenceValue"]}>
                          {t("{fu} fu", { fu: String(profile.doubleWindPairFu) })}
                        </dd>
                      </div>
                    </dl>
                    {profile.id === houseRulesProfileId ? (
                      <p className={styles["requirement"]}>
                        {t("Yours to set, in Setup. Everything else follows WRC 2025.")}
                      </p>
                    ) : null}
                    {/* Every published profile cites the document it follows, so a
                        disagreement at the table can be settled by reading it. */}
                    {profile.sourceUrl === null ? null : (
                      <a className={styles["source"]} href={profile.sourceUrl} rel="noreferrer">
                        {t("Read the published rules")}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
