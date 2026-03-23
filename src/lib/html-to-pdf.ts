/**
 * Client-side HTML-to-PDF converter using jsPDF + html2canvas.
 * Captures each page element (.cover-page, .page) individually
 * and assembles them into a multi-page PDF.
 */

export async function htmlToPdfBlob(htmlString: string): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  // Create an off-screen container to render the HTML
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "816px"; // Letter width at 96 DPI
  container.style.background = "#fff";
  container.style.zIndex = "-9999";
  document.body.appendChild(container);

  try {
    // Parse the HTML document
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");

    // Create a shadow root to isolate styles
    const shadow = container.attachShadow({ mode: "open" });
    const wrapper = document.createElement("div");
    wrapper.style.width = "816px";
    wrapper.style.background = "#fff";

    // Copy all styles from the parsed document
    const styles = doc.querySelectorAll("style");
    styles.forEach((s) => {
      const cloned = document.createElement("style");
      cloned.textContent = s.textContent;
      shadow.appendChild(cloned);
    });

    // Override page-related styles for capture: force page heights,
    // remove vh units (they don't work in off-screen containers),
    // and ensure pages are sized for letter format.
    const overrideStyle = document.createElement("style");
    overrideStyle.textContent = `
      .cover-page, .page {
        min-height: 1056px !important; /* Letter height at 96dpi */
        height: 1056px !important;
        max-height: 1056px !important;
        overflow: hidden !important;
        page-break-after: auto !important;
        box-sizing: border-box !important;
      }
      .cover-page {
        width: 816px !important;
      }
      .page {
        width: 816px !important;
      }
      @media screen {
        .cover-page, .page {
          max-width: none !important;
          margin: 0 !important;
          box-shadow: none !important;
        }
      }
    `;
    shadow.appendChild(overrideStyle);

    // Copy body children
    const bodyChildren = Array.from(doc.body.children);
    for (const child of bodyChildren) {
      wrapper.appendChild(child.cloneNode(true));
    }
    shadow.appendChild(wrapper);

    // Wait for styles to apply and any images to start loading
    await new Promise((r) => setTimeout(r, 600));

    // Wait for all images to load
    const images = shadow.querySelectorAll("img");
    if (images.length > 0) {
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );
    }

    // Find all page elements
    const pages = shadow.querySelectorAll(".cover-page, .page");

    // Letter size in points: 612 x 792
    const pdf = new jsPDF("p", "pt", "letter");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    if (pages.length === 0) {
      // Fallback: capture the entire wrapper as one page
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        width: 816,
        windowWidth: 816,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // Handle content taller than one page
      let position = 0;
      while (position < imgHeight) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -position, pdfWidth, imgHeight);
        position += pdfHeight;
      }
    } else {
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          width: 816,
          height: 1056,
          windowWidth: 816,
          backgroundColor:
            pages[i].classList.contains("cover-page") ? undefined : "#ffffff",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}
