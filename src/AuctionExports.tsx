import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./AuctionExports.css";

import {
  loadAuctionHistory,
  loadAuctionPlayers,
  loadTeams,
  loadTournamentSettings,
  type AuctionDivision,
  type DatabaseHistoryEntry,
} from "./database";

import type {
  AuctionPlayer,
  Team,
  TournamentSettings,
} from "./types";

type AuctionExportsProps = {
  onBack: () => void;
  division: AuctionDivision;
};

type ExportRow = {
  playerName: string;
  role: string;
  status: "SOLD" | "UNSOLD" | "PENDING";
  teamName: string;
  basePrice: number;
  purchasePrice: number | null;
};

function AuctionExports({
  onBack,
  division,
}: AuctionExportsProps) {
  const [teams, setTeams] =
    useState<Team[]>([]);

  const [players, setPlayers] =
    useState<AuctionPlayer[]>([]);

  const [history, setHistory] =
    useState<DatabaseHistoryEntry[]>([]);

  const [settings, setSettings] =
    useState<TournamentSettings>({
      tournamentName:
        "CRICKET AUCTION ARENA",
      seasonName:
        "Season 2026",
      squadLimit:
        18,
    });

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadData =
    useCallback(async () => {
      try {
        setErrorMessage("");

        const [
          loadedTeams,
          loadedPlayers,
          loadedHistory,
          loadedSettings,
        ] =
          await Promise.all([
            loadTeams(division),
            loadAuctionPlayers(division),
            loadAuctionHistory(division),
            loadTournamentSettings(division),
          ]);

        setTeams(
          loadedTeams
        );

        setPlayers(
          loadedPlayers
        );

        setHistory(
          loadedHistory
        );

        setSettings(
          loadedSettings
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setErrorMessage(
          error instanceof
            Error
            ? error.message
            : "Unable to load auction export data."
        );
      } finally {
        setLoading(
          false
        );
      }
    }, [division]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows =
    useMemo<ExportRow[]>(
      () => {
        const soldLookup =
          new Map<
            number,
            {
              teamName:
                string;
              purchasePrice:
                number;
            }
          >();

        teams.forEach(
          (team) => {
            team.players.forEach(
              (player) => {
                soldLookup.set(
                  player.id,
                  {
                    teamName:
                      team.name,

                    purchasePrice:
                      player.purchasePrice,
                  }
                );
              }
            );
          }
        );

        const unsoldIds =
          new Set(
            history
              .filter(
                (entry) =>
                  entry.status ===
                  "UNSOLD"
              )
              .map(
                (entry) =>
                  entry.playerId
              )
          );

        return players.map(
          (player) => {
            const sold =
              soldLookup.get(
                player.id
              );

            if (sold) {
              return {
                playerName:
                  player.name,

                role:
                  player.role,

                status:
                  "SOLD",

                teamName:
                  sold.teamName,

                basePrice:
                  player.basePrice,

                purchasePrice:
                  sold.purchasePrice,
              };
            }

            if (
              unsoldIds.has(
                player.id
              )
            ) {
              return {
                playerName:
                  player.name,

                role:
                  player.role,

                status:
                  "UNSOLD",

                teamName:
                  "",

                basePrice:
                  player.basePrice,

                purchasePrice:
                  null,
              };
            }

            return {
              playerName:
                player.name,

              role:
                player.role,

              status:
                "PENDING",

              teamName:
                "",

              basePrice:
                player.basePrice,

              purchasePrice:
                null,
            };
          }
        );
      },
      [
        teams,
        players,
        history,
      ]
    );

  const teamSummary =
    useMemo(
      () =>
        teams.map(
          (team) => {
            const spent =
              team.players.reduce(
                (
                  total,
                  player
                ) =>
                  total +
                  player.purchasePrice,
                0
              );

            return {
              name:
                team.name,

              shortName:
                team.shortName,

              players:
                team.players.length,

              spent,

              remaining:
                team.startingPurse -
                spent,

              slotsLeft:
                Math.max(
                  0,
                  settings.squadLimit -
                    team.players.length
                ),
            };
          }
        ),
      [
        teams,
        settings.squadLimit,
      ]
    );

  const soldCount =
    rows.filter(
      (row) =>
        row.status ===
        "SOLD"
    ).length;

  const unsoldCount =
    rows.filter(
      (row) =>
        row.status ===
        "UNSOLD"
    ).length;

  const pendingCount =
    rows.filter(
      (row) =>
        row.status ===
        "PENDING"
    ).length;

  const totalSpent =
    teamSummary.reduce(
      (
        total,
        team
      ) =>
        total +
        team.spent,
      0
    );

  const safeFileName =
    `${settings.tournamentName}-${settings.seasonName}`
      .replace(
        /[^a-z0-9]+/gi,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      )
      .toLowerCase();

  const downloadBlob =
    (
      content:
        BlobPart,
      mimeType:
        string,
      fileName:
        string
    ) => {
      const blob =
        new Blob(
          [content],
          {
            type:
              mimeType,
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        url;

      anchor.download =
        fileName;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
      );
    };

  const csvEscape =
    (
      value:
        string | number
    ) => {
      const text =
        String(value);

      return `"${text.replaceAll(
        '"',
        '""'
      )}"`;
    };

  const exportCsv =
    () => {
      const lines: string[] =
        [];

      lines.push(
        [
          "Player",
          "Role",
          "Status",
          "Team",
          "Base Price (Cr)",
          "Purchase Price (Cr)",
        ]
          .map(csvEscape)
          .join(",")
      );

      rows.forEach(
        (row) => {
          lines.push(
            [
              row.playerName,
              row.role,
              row.status,
              row.teamName,
              row.basePrice.toFixed(
                2
              ),
              row.purchasePrice ===
              null
                ? ""
                : row.purchasePrice.toFixed(
                    2
                  ),
            ]
              .map(csvEscape)
              .join(",")
          );
        }
      );

      lines.push("");
      lines.push(
        csvEscape(
          "TEAM SUMMARY"
        )
      );

      lines.push(
        [
          "Team",
          "Short Name",
          "Players",
          "Spent (Cr)",
          "Remaining Purse (Cr)",
          "Slots Left",
        ]
          .map(csvEscape)
          .join(",")
      );

      teamSummary.forEach(
        (team) => {
          lines.push(
            [
              team.name,
              team.shortName,
              team.players,
              team.spent.toFixed(
                2
              ),
              team.remaining.toFixed(
                2
              ),
              team.slotsLeft,
            ]
              .map(csvEscape)
              .join(",")
          );
        }
      );

      downloadBlob(
        "\ufeff" +
          lines.join(
            "\r\n"
          ),
        "text/csv;charset=utf-8",
        `${safeFileName}-results.csv`
      );
    };

  const xmlEscape =
    (
      value: string
    ) =>
      value
        .replaceAll(
          "&",
          "&amp;"
        )
        .replaceAll(
          "<",
          "&lt;"
        )
        .replaceAll(
          ">",
          "&gt;"
        )
        .replaceAll(
          '"',
          "&quot;"
        )
        .replaceAll(
          "'",
          "&apos;"
        );

  const excelCell =
    (
      value:
        string | number,
      type:
        "String" | "Number" =
          "String"
    ) =>
      `<Cell><Data ss:Type="${type}">${xmlEscape(
        String(value)
      )}</Data></Cell>`;

  const exportExcel =
    () => {
      const playerRows =
        rows
          .map(
            (row) =>
              `<Row>
${excelCell(row.playerName)}
${excelCell(row.role)}
${excelCell(row.status)}
${excelCell(row.teamName)}
${excelCell(row.basePrice, "Number")}
${row.purchasePrice === null ? excelCell("") : excelCell(row.purchasePrice, "Number")}
</Row>`
          )
          .join("\n");

      const teamRows =
        teamSummary
          .map(
            (team) =>
              `<Row>
${excelCell(team.name)}
${excelCell(team.shortName)}
${excelCell(team.players, "Number")}
${excelCell(team.spent, "Number")}
${excelCell(team.remaining, "Number")}
${excelCell(team.slotsLeft, "Number")}
</Row>`
          )
          .join("\n");

      const xml =
        `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Player Results">
    <Table>
      <Row>
        ${excelCell("Player")}
        ${excelCell("Role")}
        ${excelCell("Status")}
        ${excelCell("Team")}
        ${excelCell("Base Price (Cr)")}
        ${excelCell("Purchase Price (Cr)")}
      </Row>
      ${playerRows}
    </Table>
  </Worksheet>

  <Worksheet ss:Name="Team Summary">
    <Table>
      <Row>
        ${excelCell("Team")}
        ${excelCell("Short Name")}
        ${excelCell("Players")}
        ${excelCell("Spent (Cr)")}
        ${excelCell("Remaining Purse (Cr)")}
        ${excelCell("Slots Left")}
      </Row>
      ${teamRows}
    </Table>
  </Worksheet>
</Workbook>`;

      downloadBlob(
        xml,
        "application/vnd.ms-excel",
        `${safeFileName}-results.xls`
      );
    };

  const escapePdfText =
    (
      value: string
    ) =>
      value
        .replaceAll(
          "\\",
          "\\\\"
        )
        .replaceAll(
          "(",
          "\\("
        )
        .replaceAll(
          ")",
          "\\)"
        )
        .replace(
          /[^\x20-\x7E]/g,
          ""
        );

  const createPdf =
    (
      lines: string[]
    ) => {
      const pageWidth =
        595;

      const pageHeight =
        842;

      const margin =
        44;

      const lineHeight =
        14;

      const maxLines =
        50;

      const pages: string[][] =
        [];

      for (
        let i = 0;
        i < lines.length;
        i += maxLines
      ) {
        pages.push(
          lines.slice(
            i,
            i +
              maxLines
          )
        );
      }

      const objects: string[] =
        [];

      const catalogId =
        1;

      const pagesId =
        2;

      const fontId =
        3;

      let nextId =
        4;

      const pageIds: number[] =
        [];

      const contentIds: number[] =
        [];

      pages.forEach(
        () => {
          pageIds.push(
            nextId++
          );

          contentIds.push(
            nextId++
          );
        }
      );

      objects[catalogId] =
        `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

      objects[pagesId] =
        `<< /Type /Pages /Kids [${pageIds
          .map(
            (id) =>
              `${id} 0 R`
          )
          .join(" ")}] /Count ${pageIds.length} >>`;

      objects[fontId] =
        `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

      pages.forEach(
        (
          pageLines,
          index
        ) => {
          const pageId =
            pageIds[index];

          const contentId =
            contentIds[index];

          objects[pageId] =
            `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;

          let stream =
            "BT\n/F1 10 Tf\n";

          pageLines.forEach(
            (
              line,
              lineIndex
            ) => {
              const y =
                pageHeight -
                margin -
                lineIndex *
                  lineHeight;

              stream +=
                `1 0 0 1 ${margin} ${y} Tm (${escapePdfText(
                  line
                )}) Tj\n`;
            }
          );

          stream +=
            "ET";

          objects[contentId] =
            `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
        }
      );

      let pdf =
        "%PDF-1.4\n";

      const offsets: number[] =
        [0];

      for (
        let id = 1;
        id < objects.length;
        id++
      ) {
        offsets[id] =
          pdf.length;

        pdf +=
          `${id} 0 obj\n${objects[id]}\nendobj\n`;
      }

      const xrefOffset =
        pdf.length;

      pdf +=
        `xref\n0 ${objects.length}\n`;

      pdf +=
        "0000000000 65535 f \n";

      for (
        let id = 1;
        id < objects.length;
        id++
      ) {
        pdf +=
          `${String(
            offsets[id]
          ).padStart(
            10,
            "0"
          )} 00000 n \n`;
      }

      pdf +=
        `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

      return pdf;
    };

  const exportPdf =
    () => {
      const lines: string[] =
        [
          settings.tournamentName,
          settings.seasonName,
          "",
          "AUCTION RESULTS",
          `Sold: ${soldCount} | Unsold: ${unsoldCount} | Pending: ${pendingCount}`,
          `Total Spent: INR ${totalSpent.toFixed(
            2
          )} Cr`,
          "",
          "PLAYER RESULTS",
          "------------------------------------------------------------",
        ];

      rows.forEach(
        (row) => {
          const price =
            row.purchasePrice ===
            null
              ? "-"
              : `${row.purchasePrice.toFixed(
                  2
                )} Cr`;

          lines.push(
            `${row.playerName} | ${row.role} | ${row.status} | ${row.teamName || "-"} | ${price}`
          );
        }
      );

      lines.push("");
      lines.push(
        "TEAM SUMMARY"
      );
      lines.push(
        "------------------------------------------------------------"
      );

      teamSummary.forEach(
        (team) => {
          lines.push(
            `${team.name} | Players ${team.players}/${settings.squadLimit} | Spent ${team.spent.toFixed(
              2
            )} Cr | Remaining ${team.remaining.toFixed(
              2
            )} Cr`
          );
        }
      );

      const pdf =
        createPdf(
          lines
        );

      downloadBlob(
        pdf,
        "application/pdf",
        `${safeFileName}-results.pdf`
      );
    };

  if (
    loading
  ) {
    return (
      <div className="auction-exports-loading">
        Preparing auction results...
      </div>
    );
  }

  return (
    <div className="auction-exports-page">
      <div className="auction-exports-topbar">
        <button
          onClick={
            onBack
          }
        >
          ← Back to Auction Board
        </button>

        <div>
          ADMIN • EXPORTS
        </div>
      </div>

      <main className="auction-exports-content">
        <section className="auction-exports-hero">
          <div>
            <p>
              AUCTION REPORTING
            </p>

            <h1>
              Results Export
            </h1>

            <span>
              Export complete player results and team summaries directly from the live Supabase data.
            </span>
          </div>

          <button
            onClick={() =>
              void loadData()
            }
          >
            REFRESH DATA
          </button>
        </section>

        {errorMessage && (
          <div className="auction-exports-error">
            {
              errorMessage
            }
          </div>
        )}

        <section className="auction-exports-stats">
          <div>
            <span>
              SOLD
            </span>

            <strong>
              {
                soldCount
              }
            </strong>
          </div>

          <div>
            <span>
              UNSOLD
            </span>

            <strong>
              {
                unsoldCount
              }
            </strong>
          </div>

          <div>
            <span>
              PENDING
            </span>

            <strong>
              {
                pendingCount
              }
            </strong>
          </div>

          <div>
            <span>
              TOTAL SPENT
            </span>

            <strong>
              ₹
              {
                totalSpent.toFixed(
                  2
                )
              }{" "}
              Cr
            </strong>
          </div>
        </section>

        <section className="auction-exports-card">
          <div>
            <p>
              DOWNLOAD REPORTS
            </p>

            <h2>
              Choose an export format
            </h2>
          </div>

          <div className="auction-export-options">
            <button
              className="excel"
              onClick={
                exportExcel
              }
            >
              <strong>
                EXCEL
              </strong>

              <span>
                Player Results + Team Summary
              </span>

              <small>
                .xls
              </small>
            </button>

            <button
              className="pdf"
              onClick={
                exportPdf
              }
            >
              <strong>
                PDF
              </strong>

              <span>
                Printable auction results report
              </span>

              <small>
                .pdf
              </small>
            </button>

            <button
              className="csv"
              onClick={
                exportCsv
              }
            >
              <strong>
                CSV
              </strong>

              <span>
                Portable raw auction data
              </span>

              <small>
                .csv
              </small>
            </button>
          </div>
        </section>

        <section className="auction-exports-preview">
          <div className="auction-exports-preview-heading">
            <div>
              <p>
                EXPORT PREVIEW
              </p>

              <h2>
                Team Summary
              </h2>
            </div>

            <strong>
              {
                settings.tournamentName
              }
            </strong>
          </div>

          <div className="auction-exports-team-list">
            {teamSummary.map(
              (team) => (
                <article
                  key={
                    team.name
                  }
                >
                  <div>
                    <strong>
                      {
                        team.name
                      }
                    </strong>

                    <span>
                      {
                        team.shortName
                      }
                    </span>
                  </div>

                  <div>
                    <span>
                      PLAYERS
                    </span>

                    <strong>
                      {
                        team.players
                      }
                      /
                      {
                        settings.squadLimit
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      SPENT
                    </span>

                    <strong>
                      ₹
                      {
                        team.spent.toFixed(
                          2
                        )
                      }{" "}
                      Cr
                    </strong>
                  </div>

                  <div>
                    <span>
                      PURSE LEFT
                    </span>

                    <strong>
                      ₹
                      {
                        team.remaining.toFixed(
                          2
                        )
                      }{" "}
                      Cr
                    </strong>
                  </div>
                </article>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AuctionExports;
