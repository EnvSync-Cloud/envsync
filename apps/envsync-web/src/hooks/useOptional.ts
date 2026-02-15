import { Dispatch, SetStateAction, useState } from "react";

export const useOptional = <T>(props: {
  value: T;
  setValue: Dispatch<SetStateAction<T>>;
  defaultValue?: T;
}) => {
  const [internalItem, setInternalItem] = useState<T>(props.defaultValue);

  const item = props.value ?? internalItem;

  const setItem = (value: T) => {
    props.setValue(value);
    setInternalItem(value);
  };

  return [item, setItem] as const;
};
