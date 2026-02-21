import { readFileSync } from "fs";

const envStr = readFileSync(".env", "utf8");
const envFn = () => {
  let vars = {};
  envStr.split("\n").forEach((line) => {
    if (!line || line.startsWith("#")) return;
    const [k, ...v] = line.split("=");
    vars[k.trim()] = v
      .join("=")
      .trim()
      .replace(/^['"]|['"]$/g, "");
  });
  return vars;
};
const env = envFn();

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/commands`;

  const payload = [
    {
      name: "ask",
      description: "Faz uma pergunta profunda ou técnica ao El Matadore",
      options: [
        {
          name: "pergunta",
          description: "A pergunta que você deseja desvendar",
          type: 3, // STRING
          required: true,
        },
      ],
    },
  ];

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    console.log("Comandos registrados com sucesso!");
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.error("Erro ao registrar comandos:");
    const text = await response.text();
    console.error(text);
  }
}

registerCommands();
