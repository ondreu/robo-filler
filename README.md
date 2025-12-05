# Article Search App - Robo Filler

Statická webová aplikace pro vyhledávání článků v databázi komponent.

## Funkce

- 🔍 **Tři režimy vyhledávání**: Fuzzy search, Wild Card, Kombinovaný
- 🎯 **Flexibilní vyhledávání**: Vyhledávání podle názvu, typového označení, výrobce, artiklu
- 📊 **Inteligentní skórování**: Automatické hodnocení shody s minimalizací vlivu formátovacích rozdílů
- 🎨 **Barevné označení výsledků**: Vizuální rozlišení kvality shody
- 🏢 **Dvě databáze**: Ústí (zelená) a Effretikon (červená)
- 📁 **Excel import/export**: Hromadné doplnění typových označení
- ⚙️ **Vlastní databáze**: Možnost nahrát vlastní CSV soubor
- 🎨 **Catppuccin Mocha design**: Moderní, tmavé, zaoblené UI
- 📱 **Responsivní**: Funguje na desktopech i mobilech

## Instalace a spuštění

### Lokálně

```bash
# Instalace závislostí
npm install

# Spuštění vývojového serveru
npm run dev

# Build pro produkci
npm run build

# Preview produkční verze
npm run preview
```

### Deployment na GitHub Pages

```bash
# Build a deploy
npm run deploy
```

Aplikace bude dostupná na: `https://<username>.github.io/robo-filler/`

## Formát CSV

CSV soubory musí být ve formátu:

```
Typové označení;Artikl;Výrobce;Název;Číslo dílu výrobce
```

Příklad:
```
ESG32SH0500;10009656;SCHALTAG;KABEL X1 - M1/S1;
733-202/000-044;10013442;BAUMER;Kabel s M8 F 0°/ volny 3x0,25 5m GY;10127787
```

## Použití

1. **Výběr databáze**: Přepněte mezi databázemi Ústí a Effretikon
2. **Zadání hledaného výrazu**: Napište co hledáte do vyhledávacího pole
3. **Výběr režimu**: Zvolte Fuzzy, Wild Card nebo Kombinovaný režim
4. **Výběr pole**: Vyberte ve kterém poli chcete vyhledávat
5. **Filtrování**: Volitelně filtrujte výsledky podle výrobců
6. **Excel import**: Nahrajte Excel s jedním sloupcem pro hromadné doplnění

## Technologie

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Fuse.js (fuzzy search)
- SheetJS (Excel)
- Lucide React (ikony)

## Struktura projektu

```
robo-filler/
├── public/
│   ├── master-data.csv          # Databáze Ústí
│   └── master-data-effi.csv     # Databáze Effretikon
├── src/
│   ├── components/              # React komponenty
│   ├── utils/                   # Pomocné funkce
│   ├── types.ts                 # TypeScript typy
│   ├── App.tsx                  # Hlavní komponenta
│   ├── main.tsx                 # Entry point
│   └── index.css                # Styly
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Licence

Vytvořeno pro Robo Filler
