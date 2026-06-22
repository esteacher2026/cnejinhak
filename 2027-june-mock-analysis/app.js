const exams = {
  guk: {
    title: "국수영 분석",
    label: "Korean · Math · English",
    src: "guk/index.html",
    pdf: "guk/source.pdf",
  },
  tamgu: {
    title: "탐구 분석",
    label: "Social Studies · Science",
    src: "tamgu/index.html",
    pdf: "tamgu/source.pdf",
  },
};

const frame = document.querySelector("#examFrame");
const viewerTitle = document.querySelector("#viewerTitle");
const viewerType = document.querySelector("#viewerType");
const pdfLink = document.querySelector("#pdfLink");
const openLink = document.querySelector("#openLink");
const controls = [...document.querySelectorAll("[data-exam]")];

function activateExam(key) {
  const exam = exams[key] || exams.guk;

  controls.forEach((control) => {
    control.classList.toggle("is-active", control.dataset.exam === key);
  });

  viewerTitle.textContent = exam.title;
  viewerType.textContent = exam.label;
  pdfLink.href = exam.pdf;
  openLink.href = exam.src;
  frame.title = exam.title;

  if (!frame.src.endsWith(exam.src)) {
    frame.src = exam.src;
  }

  history.replaceState(null, "", `#${key}`);
}

controls.forEach((control) => {
  control.addEventListener("click", () => {
    activateExam(control.dataset.exam);
    document.querySelector("#viewer").scrollIntoView({ block: "start", behavior: "smooth" });
  });
});

const initial = location.hash.replace("#", "");
activateExam(exams[initial] ? initial : "guk");
