import { render } from "@testing-library/react";

import { createLogger } from "..";

import { sleep } from "./utils";

const initFn = vi.fn();
const clickFn = vi.fn();
const flushFn = vi.fn();
const pageViewFn = vi.fn();
const FLUSH_INTERVAL = 500;

const [Log] = createLogger({
  init: initFn,
  DOMEvents: {
    onClick: clickFn,
  },
  pageView: {
    onPageView: pageViewFn,
  },
  batch: {
    enable: true,
    thresholdSize: 5,
    interval: FLUSH_INTERVAL,
    onFlush: flushFn,
  },
});

describe("batching behavior", () => {
  it("should flush the batch when the threshold size is reached", async () => {
    const clickParams = { a: 1 };

    const page = render(
      <Log.Provider initialContext={{}}>
        <Log.Click params={clickParams}>
          <button type="button">click</button>
        </Log.Click>
      </Log.Provider>,
    );

    expect(flushFn).not.toHaveBeenCalled();

    clickFn.mockImplementation((params) => params);

    const button = page.getByText("click");

    button.click();

    expect(flushFn).not.toHaveBeenCalled();

    button.click();
    button.click();
    button.click();
    button.click();

    expect(clickFn).toHaveBeenCalledTimes(5);
    expect(flushFn).toHaveBeenNthCalledWith(
      1,
      [clickParams, clickParams, clickParams, clickParams, clickParams],
      false,
    );
  });

  it("should flush the batch when the interval is reached", async () => {
    const clickParams = { a: 1 };

    const page = render(
      <Log.Provider initialContext={{}}>
        <Log.Click params={clickParams}>
          <button type="button">click</button>
        </Log.Click>
      </Log.Provider>,
    );

    clickFn.mockImplementation((params) => params);

    const button = page.getByText("click");

    button.click();
    button.click();
    button.click();

    expect(flushFn).not.toHaveBeenCalled();

    await sleep(FLUSH_INTERVAL);

    expect(clickFn).toHaveBeenCalledTimes(3);
    expect(flushFn).toHaveBeenNthCalledWith(1, [clickParams, clickParams, clickParams], false);
  });

  it("should flush the batch when the page is unmounted", async () => {
    const clickParams = { a: 1 };

    const page = render(
      <Log.Provider initialContext={{}}>
        <Log.Click params={clickParams}>
          <button type="button">click</button>
        </Log.Click>
      </Log.Provider>,
    );

    clickFn.mockImplementation((params) => params);

    const button = page.getByText("click");

    button.click();
    button.click();

    expect(flushFn).not.toHaveBeenCalled();

    page.unmount();

    expect(flushFn).toHaveBeenNthCalledWith(1, [clickParams, clickParams], false);
  });

  it("should flush the batch when the browser is closed", () => {
    const clickParams = { a: 1 };

    const page = render(
      <Log.Provider initialContext={{}}>
        <Log.Click params={clickParams}>
          <button type="button">click</button>
        </Log.Click>
      </Log.Provider>,
    );

    clickFn.mockImplementation((params) => params);

    const button = page.getByText("click");

    button.click();
    button.click();

    expect(flushFn).not.toHaveBeenCalled();

    document.dispatchEvent(new Event("beforeunload"));

    expect(flushFn).toHaveBeenCalledWith([clickParams, clickParams], true);
  });

  it("should wait for init function to be resolved before interval starts", async () => {
    const clickParams = { a: 1 };
    initFn.mockImplementationOnce(() => sleep(300));

    const page = render(
      <Log.Provider initialContext={{}}>
        <Log.Click params={clickParams}>
          <button type="button">click</button>
        </Log.Click>
      </Log.Provider>,
    );

    const button = page.getByText("click");
    button.click();
    button.click();

    // clickFn should not have been called yet
    expect(clickFn).not.toHaveBeenCalled();

    // wait for init function to be resolved
    await sleep(300);

    // clickFn should have been called now
    expect(clickFn).toHaveBeenCalledTimes(2);
    expect(flushFn).not.toHaveBeenCalled();

    // wait for interval
    await sleep(FLUSH_INTERVAL);

    // flushFn should have been called now
    expect(flushFn).toHaveBeenCalled();
  });
});

// This test must pass before v1.0.0
// describe("LogScheduler race condition", () => {
//   it("should assure the event order when the event function's return value is a Promise", async () => {
//     const event1 = () => sleep(1000);
//     const event2 = () => sleep(500);

//     pageViewFn.mockImplementationOnce(event1);
//     clickFn.mockImplementationOnce(event2);

//     const page = render(
//       <Log.Provider initialContext={{}}>
//         <Log.Click params={{ b: 1 }}>
//           <button type="button">click</button>
//         </Log.Click>
//         <Log.PageView params={{ a: 1 }} />
//       </Log.Provider>,
//     );

//     page.getByText("click").click();

//     expect(clickFn).not.toHaveBeenCalled();

//     await sleep(500);

//     expect(clickFn).toHaveBeenCalledWith({ b: 1 }, {}, anyFn);
//   });
