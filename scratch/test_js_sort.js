const testData = [
  { MinisterName: "홍길동", NOHNAME: "서울노회" },
  { MinisterName: "강감찬", NOHNAME: "서울노회" },
  { MinisterName: "이순신", NOHNAME: "서울노회" },
];

testData.sort((a, b) => {
  const nameA = (a.MinisterName || '').trim();
  const nameB = (b.MinisterName || '').trim();
  return nameA.localeCompare(nameB, 'ko');
});

console.log("Sorted array:", testData.map(d => d.MinisterName));

if (testData[0].MinisterName === "강감찬" && testData[1].MinisterName === "이순신" && testData[2].MinisterName === "홍길동") {
  console.log("JS Sort Test: SUCCESS");
} else {
  console.error("JS Sort Test: FAILED", testData);
  process.exit(1);
}
